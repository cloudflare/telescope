// Generate a test_id from config date
export function generateTestId(config_date: string): string {
  const date_ob = new Date(config_date);
  const date = date_ob.getDate().toString().padStart(2, '0');
  const month = (date_ob.getMonth() + 1).toString().padStart(2, '0');
  const year = date_ob.getFullYear();
  const hour = date_ob.getHours().toString().padStart(2, '0');
  const minute = date_ob.getMinutes().toString().padStart(2, '0');
  const second = date_ob.getSeconds().toString().padStart(2, '0');
  return `${year}_${month}_${date}_${hour}_${minute}_${second}_${crypto.randomUUID()}`;
}
