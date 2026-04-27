import { Sparkles, Loader2 } from 'lucide-react';

export default function FocusLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/50 via-white to-pink-50/30 grid place-items-center">
      <div className="text-center">
        <div className="relative inline-block mb-4">
          <Sparkles className="w-12 h-12 text-purple-300" />
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin absolute inset-0" />
        </div>
        <p className="text-gray-600 font-medium">טוען Focus Mode...</p>
      </div>
    </div>
  );
}
