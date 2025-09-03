import React, { useState } from 'react';
import { cleanupExpiredSessions, clearAllBattleshipsData, getStorageUsage } from '../persistence';
import { getCloudStorageStats, cleanupCloudStorage } from '../cloudPersistence';

interface CleanupControlsProps {
  onDataCleared?: () => void;
}

export default function CleanupControls({ onDataCleared }: CleanupControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStorageInfo, setLocalStorageInfo] = useState<ReturnType<typeof getStorageUsage> | null>(null);
  const [cloudStorageInfo, setCloudStorageInfo] = useState<{ totalGames: number; totalSizeKB: number; activeGames: number; expiredGames: number; } | null>(null);

  const handleToggle = async () => {
    if (!isOpen) {
      // Refresh storage info when opening
      setLocalStorageInfo(getStorageUsage());
      const cloudStats = await getCloudStorageStats();
      setCloudStorageInfo(cloudStats);
    }
    setIsOpen(!isOpen);
  };

  const handleClearOldSessions = async () => {
    // Clean up local sessions
    const localCleaned = cleanupExpiredSessions();
    
    // Clean up cloud storage
    const cloudCleanup = await cleanupCloudStorage();
    const cloudCleaned = cloudCleanup?.cleanedGames || 0;
    
    alert(`🧹 Cleaned up ${localCleaned} local session(s) and ${cloudCleaned} cloud game(s)!`);
    
    // Refresh storage info
    setLocalStorageInfo(getStorageUsage());
    const cloudStats = await getCloudStorageStats();
    setCloudStorageInfo(cloudStats);
  };

  const handleClearAllData = () => {
    if (confirm('This will delete your current game and all room connections. Are you sure?')) {
      const clearedCount = clearAllBattleshipsData();
      alert(`🗑️ Cleared all local data! (${clearedCount} item(s) removed)`);
      
      // Refresh storage info
      setLocalStorageInfo(getStorageUsage());
      onDataCleared?.();
      window.location.reload();
    }
  };

  return (
    <div className="relative">
      <button
        className="btn text-sm"
        onClick={handleToggle}
        title="Storage cleanup options"
      >
        🧹 Storage
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">Storage Management</h3>
              
              <div className="text-sm text-gray-600 space-y-2">
                {localStorageInfo && (
                  <div>
                    <div className="font-medium">Local Storage:</div>
                    <div className="pl-2 space-y-1">
                      <div>Game data: {(localStorageInfo.battleshipsSize / 1024).toFixed(1)}KB</div>
                      <div>Room sessions: {localStorageInfo.sessionCount}</div>
                      <div>Usage: {localStorageInfo.percentageUsed.toFixed(1)}%</div>
                    </div>
                  </div>
                )}
                {cloudStorageInfo && (
                  <div>
                    <div className="font-medium">Cloud Storage:</div>
                    <div className="pl-2 space-y-1">
                      <div>Games: {cloudStorageInfo.activeGames} active, {cloudStorageInfo.expiredGames} expired</div>
                      <div>Size: {cloudStorageInfo.totalSizeKB}KB</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <button
                  className="w-full btn bg-blue-500 hover:bg-blue-600 text-white text-sm"
                  onClick={handleClearOldSessions}
                >
                  🧹 Clean Old Room Connections
                </button>
                
                <button
                  className="w-full btn bg-red-500 hover:bg-red-600 text-white text-sm"
                  onClick={handleClearAllData}
                >
                  🗑️ Reset All Game Data
                </button>
              </div>
              
              <div className="text-xs text-gray-500 pt-2 border-t">
                <div>• Old rooms are automatically cleaned after 7 days</div>
                <div>• Game saves expire after 1 day</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}