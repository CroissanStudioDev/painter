import { PaintingCanvas } from "@/components/PaintingCanvas";

export default function PaintPage() {
  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Paint & Play!</h1>
      <PaintingCanvas />
    </div>
  );
} 