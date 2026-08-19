import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Bell } from "lucide-react";
import { bffClient } from "@/api/bffClient";
import { CommunicationEvent } from "@/models/Domain";

const channelIcon = (channel?: string | null) => {
  switch ((channel ?? "").toLowerCase()) {
    case "email":
      return <Mail className="h-5 w-5 text-primary" />;
    case "sms":
    case "whatsapp":
      return <MessageSquare className="h-5 w-5 text-primary" />;
    default:
      return <Bell className="h-5 w-5 text-primary" />;
  }
};

const statusColor = (status?: string | null) => {
  switch ((status ?? "").toLowerCase()) {
    case "sent":
    case "delivered":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function Communications() {
  const [events, setEvents] = useState<CommunicationEvent[]>([]);

  useEffect(() => {
    bffClient.getCommunicationHistory().then(setEvents);
  }, []);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Communications</h1>
          <p className="text-muted-foreground">Emails, notifications, and messages sent to you</p>
        </div>
        <Bell className="h-8 w-8 text-primary" />
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {channelIcon(event.channel)}
                  <div>
                    <p className="font-medium text-foreground">{event.subject ?? event.body.slice(0, 60)}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {event.channel}
                      {event.recipient ? ` · ${event.recipient}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Badge className={statusColor(event.status)}>{event.status}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {event.sentAt ? new Date(event.sentAt).toLocaleDateString() : "--"}
                  </p>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-muted-foreground">
                No communications yet — ask the AI assistant to send you an email or notification.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
