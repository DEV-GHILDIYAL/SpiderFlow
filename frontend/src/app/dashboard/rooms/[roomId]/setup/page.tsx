import RoomSetupClient from "./RoomSetupClient";

export function generateStaticParams() {
  return [{ roomId: "id" }];
}

export default function RoomSetupPage() {
  return <RoomSetupClient />;
}
