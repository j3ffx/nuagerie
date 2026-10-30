import { describe, expect, it } from 'vitest';
import { GraphError } from '../graph/client.ts';
import type { GraphDriveItem } from '../graph/types.ts';
import type { MediaIndex } from '../model.ts';
import { buildIndex } from '../normalize.ts';
import { createDriveEdits, failureOf } from './driveEdits.ts';
import { createMemoryWriter } from './memoryWriter.ts';
import { albumNameProblem, isEditableAlbum, looksEmpty, moveTargets } from './rules.ts';
import { keptUntil, parseTrash, withDeleted, without } from './trash.ts';

const folder = (id: string, name: string, parent: string): GraphDriveItem => ({
  id,
  name,
  folder: {},
  parentReference: { id: parent },
});
const photo = (id: string, parent: string, name = `${id}.jpg`): GraphDriveItem => ({
  id,
  name,
  file: { mimeType: 'image/jpeg' },
  parentReference: { id: parent },
  eTag: 'e',
  size: 10,
});

/** Pictures › Animaux (2 photos), Vacances (1), 2024 (1), Vide, Docs (a PDF only). */
function drive(): GraphDriveItem[] {
  return [
    folder('pics', 'Pictures', 'drive'),
    folder('animals', 'Animaux', 'pics'),
    photo('p1', 'animals'),
    photo('p2', 'animals'),
    folder('holidays', 'Vacances', 'pics'),
    photo('p3', 'holidays'),
    folder('year', '2024', 'pics'),
    photo('p4', 'year'),
    folder('empty', 'Vide', 'pics'),
    folder('docs', 'Docs', 'pics'),
    {
      id: 'pdf',
      name: 'notes.pdf',
      file: { mimeType: 'application/pdf' },
      parentReference: { id: 'docs' },
    },
    folder('outside', 'Documents', 'drive'),
    photo('elsewhere', 'outside'),
  ];
}

const build = (items: GraphDriveItem[]): MediaIndex => buildIndex(items, ['pics'], () => null);

function setup() {
  const items = drive();
  const writer = createMemoryWriter(items);
  let index = build(items);
  const edits = createDriveEdits({
    writer,
    index: async () => index,
    apply: async () => (index = build(items)),
  });
  return { items, edits, current: () => index };
}

const ids = (index: MediaIndex) => index.items.map((item) => item.id).sort();

describe('rules', () => {
  const index = build(drive());

  it('lets albums below the root folders change, never a root or a technical folder', () => {
    expect(isEditableAlbum(index, 'animals')).toBe(true);
    expect(isEditableAlbum(index, 'pics')).toBe(false);
    expect(isEditableAlbum(index, 'year')).toBe(false);
    expect(isEditableAlbum(index, 'outside')).toBe(false);
  });

  it('tells an album empty only when the index has nothing in it', () => {
    expect(looksEmpty(index, 'empty')).toBe(true);
    expect(looksEmpty(index, 'animals')).toBe(false);
    expect(looksEmpty(index, 'pics')).toBe(false);
    // A PDF is not in the index: OneDrive is asked before deleting.
    expect(looksEmpty(index, 'docs')).toBe(true);
  });

  it('offers every album as a place to move to, by its path, never a technical folder', () => {
    expect(moveTargets(index).map((target) => target.path.join(' › '))).toEqual([
      'Pictures',
      'Pictures › Animaux',
      'Pictures › Docs',
      'Pictures › Vacances',
      'Pictures › Vide',
    ]);
  });

  it('refuses names OneDrive forbids, technical ones and those a sibling has', () => {
    expect(albumNameProblem(index, 'pics', '  Chats  ')).toBeNull();
    expect(albumNameProblem(index, 'pics', '   ')).toBe('empty');
    expect(albumNameProblem(index, 'pics', 'a/b')).toBe('characters');
    expect(albumNameProblem(index, 'pics', 'fin.')).toBe('characters');
    expect(albumNameProblem(index, 'pics', 'x'.repeat(121))).toBe('tooLong');
    expect(albumNameProblem(index, 'pics', '2023')).toBe('technical');
    expect(albumNameProblem(index, 'pics', 'Sans date')).toBe('technical');
    expect(albumNameProblem(index, 'year', '07')).toBe('technical');
    expect(albumNameProblem(index, 'animals', '07')).toBeNull();
    expect(albumNameProblem(index, 'pics', 'vacances')).toBe('taken');
    // Its own name, when renaming it: only the case changes.
    expect(albumNameProblem(index, 'pics', 'vacances', 'holidays')).toBeNull();
  });
});

describe('createDriveEdits', () => {
  it('deletes photos of the index only, and the index follows at once', async () => {
    const { edits, current } = setup();
    const progress: number[] = [];
    const result = await edits.deleteItems(['p1', 'elsewhere', 'animals'], (done) =>
      progress.push(done),
    );
    expect(result.done).toEqual(['p1']);
    expect(result.failed).toEqual([
      { id: 'elsewhere', reason: 'refused' },
      { id: 'animals', reason: 'refused' },
    ]);
    expect(ids(current())).toEqual(['p2', 'p3', 'p4']);
    expect(result.index).toBe(current());
    expect(progress).toEqual([0, 1, 2, 3]);
  });

  it('brings deleted photos back where they were', async () => {
    const { edits, current } = setup();
    await edits.deleteItems(['p1', 'p3']);
    const result = await edits.restoreItems(['p3', 'never-deleted']);
    expect(result.done).toEqual(['p3']);
    expect(result.failed).toEqual([{ id: 'never-deleted', reason: 'gone' }]);
    expect(current().items.find((item) => item.id === 'p3')?.albumId).toBe('holidays');
  });

  it('moves photos into an album, skipping those already there and refusing other targets', async () => {
    const { edits, current } = setup();
    const result = await edits.moveItems(['p1', 'p3', 'p4'], 'holidays');
    expect(result.done.sort()).toEqual(['p1', 'p3', 'p4']);
    expect(
      current()
        .items.filter((item) => item.albumId === 'holidays')
        .map((item) => item.id)
        .sort(),
    ).toEqual(['p1', 'p3', 'p4']);
    await expect(edits.moveItems(['p2'], 'year')).rejects.toMatchObject({ reason: 'refused' });
    await expect(edits.moveItems(['p2'], 'outside')).rejects.toMatchObject({ reason: 'refused' });
  });

  it('reports a photo whose name is taken in the album, and moves the others', async () => {
    const { items, edits } = setup();
    items.push(photo('twin', 'holidays', 'p1.jpg'));
    const result = await edits.moveItems(['p1', 'p2'], 'holidays');
    expect(result.done).toEqual(['p2']);
    expect(result.failed).toEqual([{ id: 'p1', reason: 'nameTaken' }]);
  });

  it('creates and renames albums, with names an album can have', async () => {
    const { edits, current } = setup();
    const { id } = await edits.createAlbum('pics', '  Chats ');
    expect(current().folders.get(id)).toMatchObject({ name: 'Chats', parentId: 'pics' });
    await expect(edits.createAlbum('pics', 'Animaux')).rejects.toMatchObject({
      reason: 'nameTaken',
    });
    await expect(edits.createAlbum('year', 'Été')).rejects.toMatchObject({ reason: 'refused' });

    await edits.renameAlbum('animals', 'Bêtes');
    expect(current().folders.get('animals')?.name).toBe('Bêtes');
    await expect(edits.renameAlbum('pics', 'Images')).rejects.toMatchObject({
      reason: 'refused',
    });
    await expect(edits.renameAlbum('holidays', 'Bêtes')).rejects.toMatchObject({
      reason: 'nameTaken',
    });
  });

  it('deletes an album only when it is empty, as OneDrive sees it', async () => {
    const { edits, current } = setup();
    await edits.deleteAlbum('empty');
    expect(current().folders.has('empty')).toBe(false);
    await expect(edits.deleteAlbum('animals')).rejects.toMatchObject({ reason: 'refused' });
    // Empty for the index, but its PDF is still there.
    await expect(edits.deleteAlbum('docs')).rejects.toMatchObject({ reason: 'refused' });
    expect(current().folders.has('docs')).toBe(true);
  });

  it('stops asking once Microsoft no longer grants the permission', async () => {
    let calls = 0;
    const index = build(drive());
    const edits = createDriveEdits({
      writer: {
        ...createMemoryWriter(drive()),
        deleteItem: async () => {
          calls++;
          throw Object.assign(new Error('no'), { name: 'EditPermissionMissing' });
        },
      },
      index: async () => index,
      apply: async () => index,
    });
    const result = await edits.deleteItems(['p1', 'p2', 'p3', 'p4', 'p1', 'p2']);
    expect(result.failed.every((failure) => failure.reason === 'permission')).toBe(true);
    expect(calls).toBeLessThanOrEqual(4);
    expect(result.index).toBeNull();
  });

  it('names what Graph answers', () => {
    expect(failureOf(new GraphError(409, 'nameAlreadyExists', ''))).toBe('nameTaken');
    expect(failureOf(new GraphError(404, 'itemNotFound', ''))).toBe('gone');
    expect(failureOf(new GraphError(403, 'accessDenied', ''))).toBe('permission');
    expect(failureOf(new GraphError(500, 'generalException', ''))).toBe('error');
  });
});

describe('trash', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 9, 30, 12);
  const item = build(drive()).items.find((one) => one.id === 'p1')!;

  it('keeps what the app deleted, most recent first, for 30 days', () => {
    const trash = withDeleted([], [item], () => 'Animaux', now - 2 * DAY);
    expect(trash[0]).toMatchObject({ id: 'p1', albumName: 'Animaux', folderId: 'animals' });
    const again = withDeleted(trash, [item], () => 'Animaux', now);
    expect(again).toHaveLength(1);
    expect(again[0]?.deletedAt).toBe(now);
    expect(keptUntil(again[0]!)).toBe(now + 30 * DAY);

    const stored = JSON.parse(
      JSON.stringify([...again, { ...again[0], id: 'old', deletedAt: now - 31 * DAY }]),
    );
    expect(parseTrash(stored, now).map((entry) => entry.id)).toEqual(['p1']);
    expect(parseTrash('nonsense', now)).toEqual([]);
    expect(without(again, ['p1'])).toEqual([]);
  });
});
