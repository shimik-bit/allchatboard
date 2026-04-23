#!/bin/bash
# AllChatBoard — סקריפט deploy אוטומטי
# הרצה: bash deploy.sh

set -e

echo "🚀 AllChatBoard Deploy Script"
echo "=============================="
echo ""

# 1. בדיקת .env.local
if [ ! -f .env.local ]; then
  if [ -f .env.local.template ]; then
    echo "⚠  קובץ .env.local לא קיים. מעתיק מ-template..."
    cp .env.local.template .env.local
    echo ""
    echo "❌ עצור! עכשיו צריך לערוך .env.local ולמלא:"
    echo "   1. SUPABASE_SERVICE_ROLE_KEY — מ-Supabase Dashboard → Settings → API"
    echo "   2. OPENAI_API_KEY — מ-platform.openai.com/api-keys"
    echo ""
    echo "אחרי שמילאת, הרץ שוב: bash deploy.sh"
    exit 1
  else
    echo "❌ אין .env.local ואין template. אתה צריך ליצור .env.local ידנית."
    exit 1
  fi
fi

# בדיקה שכל המפתחות מלאים
if grep -q "REPLACE_WITH" .env.local; then
  echo "❌ יש ערכי REPLACE_WITH ב-.env.local. תערוך אותו ותמלא את המפתחות."
  exit 1
fi

echo "✓ .env.local תקין"

# 2. התקנת תלויות
if [ ! -d node_modules ]; then
  echo ""
  echo "📦 מתקין תלויות..."
  npm install
fi

echo "✓ תלויות מותקנות"

# 3. build מקומי לבדיקה
echo ""
echo "🔨 בודק build..."
npm run build

echo ""
echo "✅ Build עבר בהצלחה!"

# 4. Vercel deploy
echo ""
if ! command -v vercel &> /dev/null; then
  echo "📦 מתקין Vercel CLI..."
  npm i -g vercel
fi

echo ""
echo "🚀 מפרוס ל-Vercel..."
echo "   (אם זה deploy ראשון, Vercel יבקש להתחבר ולהגדיר את הפרוייקט)"
echo ""

# Link (רק בפעם הראשונה)
if [ ! -d .vercel ]; then
  vercel link
fi

# העלאת env vars ל-Vercel (רק בפעם הראשונה אם לא קיימות)
echo ""
echo "🔑 מעלה env vars ל-Vercel..."

while IFS='=' read -r key value; do
  # דלג על שורות ריקות והערות
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  # הסר רווחים
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  [[ -z "$value" ]] && continue

  # נסה להוסיף ל-production, preview, development
  echo "$value" | vercel env add "$key" production --force 2>/dev/null || echo "   → $key כבר קיים ב-production"
  echo "$value" | vercel env add "$key" preview --force 2>/dev/null || true
done < .env.local

# Deploy!
echo ""
echo "🎉 מפרוס ל-production..."
vercel --prod

echo ""
echo "=============================="
echo "✅ Deploy הושלם!"
echo ""
echo "עכשיו:"
echo "1. היכנס לאתר שקיבלת מ-Vercel"
echo "2. הירשם → עבור onboarding"
echo "3. עבור ל-Dashboard → וואטסאפ"
echo "4. הזן Instance ID + Token של Green API"
echo "5. העתק את ה-webhook URL והדבק אותו ב-Green API console"
echo ""
