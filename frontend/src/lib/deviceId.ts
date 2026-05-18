const KEY = "halftime.deviceId";

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDeviceHour(): number {
  return new Date().getHours();
}
