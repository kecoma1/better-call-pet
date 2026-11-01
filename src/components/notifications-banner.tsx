import { useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import Saul from "./saul";
import { expenseNotifications } from "../lib/notifications";
import type { Receipt } from "../domain";

export default function NotificationsBanner({
  items,
  onSelect,
  onAdd,
  onNavigate,
}: {
  items: Receipt[];
  onSelect: (receipt: Receipt) => void;
  onAdd: () => void;
  onNavigate: (page: string) => void;
}) {
  const notifications = expenseNotifications(items);
  const [selectedId, setSelectedId] = useState<string>();
  const index = Math.max(
    0,
    notifications.findIndex((notification) => notification.id === selectedId),
  );
  const notification = notifications[index];
  const hasExpenses = items.length > 0;
  const title = notification?.title ?? "You're all caught up.";
  const message =
    notification?.message ??
    (hasExpenses
      ? "All recorded expenses have been posted. Your ledger is ready whenever you need it."
      : "No expense notifications yet. Add a receipt and Saul will let you know what needs your attention.");

  function act() {
    if (notification) onSelect(notification.receipts[0]);
    else if (hasExpenses) onNavigate("Bookkeeping");
    else onAdd();
  }

  function move(direction: number) {
    setSelectedId(
      notifications[
        (index + direction + notifications.length) % notifications.length
      ].id,
    );
  }

  return (
    <Card
      className="hero-card notification-card"
      role="region"
      aria-label="Notifications"
    >
      <CardContent className="hero-content">
        <div>
          <Badge variant="outline" className="hero-badge">
            <Bell size={12} />
            NOTIFICATIONS
            {notifications.length > 0 && ` · ${notifications.length}`}
          </Badge>
          <h2 aria-live="polite" aria-atomic="true">
            {title}
          </h2>
          <p>{message}</p>
          <Button onClick={act}>
            {notification?.actionLabel ??
              (hasExpenses ? "Open bookkeeping" : "Add your first expense")}
            <ArrowRight size={16} />
          </Button>
          <div className="notification-footer">
            <small>
              <Bell size={13} />
              {notification
                ? "Updates from your expenses"
                : "No pending expense updates"}
            </small>
            {notifications.length > 1 && (
              <div className="notification-controls">
                <span aria-live="polite" aria-atomic="true">
                  {index + 1} of {notifications.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous notification"
                  onClick={() => move(-1)}
                >
                  <ChevronLeft size={15} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next notification"
                  onClick={() => move(1)}
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="hero-art">
          <div className="pixel-grid" />
          <span className="floating-note note-one">
            <CheckCheck size={14} />
            {notification?.summary ?? "Nothing waiting on you"}
          </span>
          <Saul state={notification ? "thinking" : "approved"} />
          <span className="floating-note note-two">
            {notification ? "“Let’s take care of this.”" : "“Looking good.”"}
          </span>
          <span className="art-caption">
            SAUL GOODMAN · KEEPING YOU IN THE LOOP
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
