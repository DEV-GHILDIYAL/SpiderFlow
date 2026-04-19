import RoomOverviewClient from "./RoomOverviewClient";

export function generateStaticParams() {
  return [{ roomId: "id" }];
}

export default function RoomOverviewPage() {
  return <RoomOverviewClient />;
}
