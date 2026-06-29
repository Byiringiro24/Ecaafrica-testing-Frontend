import { Wifi, WifiOff, MoreVertical, Trash2, Edit, RefreshCw } from "lucide-react";
import { Tablet } from "../../lib/tabletApi";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type DeviceCardProps = {
  tablet: Tablet;
  onConnect: (tablet: Tablet) => void;
  onDisconnect: (tablet: Tablet) => void;
  onSync: (tablet: Tablet) => void;
  onEdit: (tablet: Tablet) => void;
  onDelete: (tablet: Tablet) => void;
};

export function DeviceCard({
  tablet,
  onConnect,
  onDisconnect,
  onSync,
  onEdit,
  onDelete,
}: DeviceCardProps) {
  const isOnline = tablet.status === "online";
  const statusColor = isOnline ? "bg-green-500" : "bg-gray-400";
  const statusText = isOnline ? "Online" : "Offline";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${statusColor} ${isOnline ? "animate-pulse" : ""}`} />
          <div>
            <h3 className="font-semibold text-lg">{tablet.name}</h3>
            <p className="text-sm text-gray-500">{tablet.location || "No location set"}</p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(tablet)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(tablet)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Bridge IP:</span>
          <span className="font-medium">{tablet.ip}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Port:</span>
          <span className="font-medium">{tablet.port}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Location:</span>
          <span className="font-medium">{tablet.location || "Not set"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Status:</span>
          <span className={`font-medium ${isOnline ? "text-green-600" : "text-gray-600"}`}>
            {statusText}
          </span>
        </div>
        {tablet.lastSync && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Last Sync:</span>
            <span className="font-medium">{new Date(tablet.lastSync).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {isOnline ? (
          <>
            <Button
              onClick={() => onDisconnect(tablet)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <WifiOff className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
            <Button
              onClick={() => onSync(tablet)}
              variant="default"
              size="sm"
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync
            </Button>
          </>
        ) : (
          <Button
            onClick={() => onConnect(tablet)}
            variant="default"
            size="sm"
            className="w-full"
          >
            <Wifi className="mr-2 h-4 w-4" />
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
