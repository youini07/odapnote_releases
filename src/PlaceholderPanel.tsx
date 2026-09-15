import { Layers } from 'lucide-react';

interface PlaceholderPanelProps {
  title: string;
  description: string;
}

export default function PlaceholderPanel({ title, description }: PlaceholderPanelProps) {
  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4">
          <Layers size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">기능 준비 중입니다</h3>
        <p className="text-slate-500 text-sm text-center max-w-sm">
          이 메뉴는 추후 업데이트를 통해 제공될 예정입니다. 조금만 기다려주세요!
        </p>
      </div>
    </div>
  );
}
