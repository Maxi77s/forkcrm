export function requestNotificationPermissionOnce() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function notifyClientMessage(
  chatId: string,
  preview: string,
  clientName?: string
) {
  const title = clientName ? `Nuevo mensaje de ${clientName}` : "Nuevo mensaje de cliente";
  const body = preview?.slice(0, 120) || "Mensaje nuevo";
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      alert(`${title}\n\n${body}`);
    }
  } else {
    alert(`${title}\n\n${body}`);
  }
}
