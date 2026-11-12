import type { Metadata } from "next";
import { CreateFlow } from "@/components/create/CreateFlow";

export const metadata: Metadata = {
  title: "Create a game · Element",
};

export default function CreatePage() {
  return <CreateFlow />;
}
