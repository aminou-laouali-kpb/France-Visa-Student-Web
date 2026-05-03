import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { NotificationItem } from "@/types";

export function Notifications() {
  const { data: notifsRaw = [], refetch } = useListNotifications({});
  const notifs = notifsRaw as unknown as NotificationItem[];
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
        <Button
          variant="outline"
          onClick={async () => {
            await markAll.mutateAsync();
            refetch();
          }}
          data-testid="button-mark-all-read"
        >
          <CheckCheck className="w-4 h-4 mr-1" /> Tout marquer comme lu
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex gap-4 p-4 ${!n.isRead ? "bg-blue-50/50" : ""}`}
                onClick={async () => {
                  if (!n.isRead) {
                    await markRead.mutateAsync({ notificationId: n.id });
                    refetch();
                  }
                }}
                data-testid={`notification-${n.id}`}
              >
                <Bell className={`w-5 h-5 mt-0.5 ${!n.isRead ? "text-blue-600" : "text-slate-300"}`} />
                <div className="flex-1">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm text-slate-600 mt-0.5">{n.message}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDateTime(n.createdAt)}
                  </div>
                </div>
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />}
              </div>
            ))}
            {notifs.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Bell className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                Aucune notification
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
