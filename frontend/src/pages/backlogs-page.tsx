import { useEffect, useState } from "react";
import type { BoardSummary } from "@emergence-devops/shared";
import { api } from "../lib/api";
import { Card, CardDescription, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export function BacklogsPage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);

  useEffect(() => {
    api.getBoards().then(setBoards);
  }, []);

  const board = boards[0];

  return (
    <div className="grid gap-4">
      {board?.cards.map((card) => (
        <Card key={card.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{card.title}</CardTitle>
            <CardDescription className="mt-2">{card.description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{card.status}</Badge>
            {card.tags.map((tag) => (
              <Badge key={tag} variant="info">
                {tag}
              </Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

