/** The Network Information API (Chrome on Android): not in the DOM types everywhere. */
type Connection = EventTarget & { type?: string; saveData?: boolean };

export const connection = (): Connection | undefined =>
  (navigator as Navigator & { connection?: Connection }).connection;

/** Mobile data, or the user asked to save data: then wait for Wi-Fi. */
export const onMobileData = () => {
  const current = connection();
  return current?.type === 'cellular' || current?.saveData === true;
};
