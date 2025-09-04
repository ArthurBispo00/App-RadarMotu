import { useEffect, useState } from "react";
import { WS_URL } from "../config/env";

export function useTagPositionWS(targetPlate?: string) {
  const [pos, setPos] = useState<{x:number;y:number;id?:string;zone?:string;spot?:string}|null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data); // { id, kind, pos:{x,y}, zone, spot }
        if (targetPlate) {
          if (data.kind === "plate" && data.id?.toUpperCase() === targetPlate.toUpperCase()) {
            setPos({ ...data.pos, id: data.id, zone: data.zone, spot: data.spot });
          }
        } else {
          setPos({ ...data.pos, id: data.id, zone: data.zone, spot: data.spot });
        }
      } catch {}
    };

    return () => { try { ws.close(); } catch {} };
  }, [targetPlate]);

  return pos;
}
