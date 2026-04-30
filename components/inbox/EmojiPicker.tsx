'use client';

/**
 * EmojiPicker - small grid of common emojis for quick insertion.
 *
 * Not a full emoji-mart-level picker — that's heavyweight (~500kb) for
 * what's mostly going to be 😀, 🙏, ✨, 🎉 in customer service replies.
 * If users start asking for full emoji search we can swap to a real lib.
 *
 * Categories are roughly: smileys, hand gestures, hearts, business-y.
 * Within each category the order is "what would a customer service rep
 * actually use" rather than alphabetical or unicode order.
 */

const EMOJI_CATEGORIES = {
  'פנים': ['😊', '😀', '😄', '🤗', '🥰', '😉', '🤔', '😅', '😇', '🤩', '😎', '🥳', '🙃', '😢', '😬', '🤝'],
  'ידיים': ['👍', '🙏', '👌', '✋', '👋', '💪', '👏', '🤲', '🤞', '🤙', '👇', '👉', '☝️', '✌️'],
  'לבבות': ['❤️', '💕', '💖', '💗', '💝', '💯', '🌸', '✨', '⭐', '🎉', '🎊', '🎁', '🌹', '💐'],
  'עסקי': ['📅', '📆', '⏰', '📞', '💬', '📍', '💰', '💳', '💸', '📝', '✅', '❌', '⚠️', '📧', '🔔'],
};

export default function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-outside catcher. WhatsApp does this same pattern - dim or
          transparent overlay that closes the picker. */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div className="absolute z-40 bottom-full mb-2 right-0 bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 max-h-80 overflow-y-auto">
        {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
          <div key={cat} className="p-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 px-1 mb-1 font-medium">
              {cat}
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onSelect(e);
                    // Don't auto-close — users often want to add multiple
                  }}
                  className="w-8 h-8 grid place-items-center text-xl hover:bg-gray-100 rounded-md transition"
                  type="button"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
