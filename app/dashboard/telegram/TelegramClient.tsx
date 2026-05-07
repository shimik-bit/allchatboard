'use client';

import TelegramManager from '@/components/telegram/TelegramManager';

export default function TelegramClient({
  workspaceId,
  workspaceName,
  canEdit,
}: {
  workspaceId: string;
  workspaceName: string;
  canEdit: boolean;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TelegramManager
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        canEdit={canEdit}
      />
    </div>
  );
}
