import type { Metadata } from "next";
import { CreateFlow } from "@/components/create/CreateFlow";

export const metadata: Metadata = {
  title: "Create a game · PlayLesson",
};

export default function CreatePage() {
  return <CreateFlow />;
}
