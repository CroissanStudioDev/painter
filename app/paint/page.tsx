import { PaintingCanvas } from "@/components/PaintingCanvas";

export default function PaintPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[url('/background.png')] bg-cover bg-center">
      <PaintingCanvas />
    </div>
  );
}