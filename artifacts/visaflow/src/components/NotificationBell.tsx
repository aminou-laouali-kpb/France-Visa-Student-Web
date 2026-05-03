import {
  useGetMe,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "wouter";
import { formatDateTime } from "@/lib/utils";
import type { NotificationItem } from "@/types";

export function NotificationBell() {
  const { data: me } = useGetMe();
  const isStudent = me?.role === "student";
  const notifsHref = isStudent ? "/student/notifications" : "/app/notifications";
  const { data: notifsRaw = [], refetch } = useListNotifications({});
  const notifs = notifsRaw as unknown as NotificationItem[];
  const unread = notifs.filter((n) => !n.isRead);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative w-10 h-10 rounded-full hover:bg-slate-100 inline-flex items-center justify-center"
          aria-label={`Notifications${unread.length > 0 ? `, ${unread.length} non lues` : ""}`}
          data-testid="button-notification-bell"
        >
          <Bell className="w-5 h-5 text-slate-700" />
          {unread.length > 0 && (
            <span
              className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
              data-testid="badge-unread-count"
            >
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0 max-h-[70vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold">Notifications</div>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await markAll.mutateAsync();
                refetch();
              }}
              data-testid="button-mark-all-read-popover"
            >
              <CheckCheck className="w-4 h-4 mr-1" /> Tout lire
            </Button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifs.slice(0, 15).map((n) => (
            <button
              key={n.id}
              className={`w-full text-left flex gap-3 p-3 border-b last:border-0 hover:bg-slate-50 ${
                !n.isRead ? "bg-blue-50/40" : ""
              }`}
              onClick={async () => {
                if (!n.isRead) {
                  await markRead.mutateAsync({ notificationId: n.id });
                  refetch();
                }
              }}
              data-testid={`notification-${n.id}`}
            >
              <div className="mt-0.5 shrink-0">
                <div
                  className={`w-2 h-2 rounded-full mt-2 ${
                    !n.isRead ? "bg-blue-600" : "bg-transparent"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {n.title}
                </div>
                <div className="text-xs text-slate-600 line-clamp-2">
                  {n.message}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {formatDateTime(n.createdAt)}
                </div>
              </div>
            </button>
          ))}
          {notifs.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              Aucune notification
            </div>
          )}
        </div>
        <div className="border-t p-2 text-center">
          <Link href={notifsHref}>
            <a className="text-sm text-blue-600 hover:underline">
              Voir tout
            </a>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
