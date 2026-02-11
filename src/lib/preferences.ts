import { supabase } from './supabase';

/**
 * User Preferences System
 * Simple, extensible preferences management for users
 */

// Available themes
export type Theme = 'light' | 'dark' | 'auto';

// Available languages (easily extensible)
export type Language = 'en' | 'hi' | 'mr';

// Timezone options (common Indian timezones)
export type Timezone = 'Asia/Kolkata' | 'Asia/Dubai' | 'UTC';

// Notification preferences
export interface NotificationPreferences {
  email: boolean;
  whatsapp: boolean;
  sessionReminders: boolean;
  promotions: boolean;
}

// Main preferences interface
export interface UserPreferences {
  user_id: string;
  theme: Theme;
  language: Language;
  timezone: Timezone;
  notifications: NotificationPreferences;
  created_at?: string;
  updated_at?: string;
}

// Default preferences for new users
export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  theme: 'auto',
  language: 'en',
  timezone: 'Asia/Kolkata',
  notifications: {
    email: true,
    whatsapp: true,
    sessionReminders: true,
    promotions: false,
  },
};

/**
 * Get user preferences by user ID
 * Returns default preferences if none exist
 */
export async function getUserPreferences(
  userId: string
): Promise<{ data: UserPreferences | null; error: Error | null }> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no preferences exist, return defaults
      if (error.code === 'PGRST116') {
        return {
          data: {
            user_id: userId,
            ...DEFAULT_PREFERENCES,
          },
          error: null,
        };
      }
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Update user preferences
 * Creates new preferences if they don't exist
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: UserPreferences | null; error: Error | null }> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Basic validation
    if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
      throw new Error('Invalid theme value');
    }

    if (preferences.language && !['en', 'hi', 'mr'].includes(preferences.language)) {
      throw new Error('Invalid language value');
    }

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing preferences
      const { data, error } = await supabase
        .from('user_preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } else {
      // Create new preferences with defaults + overrides
      const { data, error } = await supabase
        .from('user_preferences')
        .insert([
          {
            user_id: userId,
            ...DEFAULT_PREFERENCES,
            ...preferences,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    }
  } catch (error) {
    console.error('Error updating preferences:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Update only notification preferences
 * Convenience function for common operation
 */
export async function updateNotificationPreferences(
  userId: string,
  notifications: Partial<NotificationPreferences>
): Promise<{ data: UserPreferences | null; error: Error | null }> {
  try {
    // Get current preferences to merge with
    const { data: current } = await getUserPreferences(userId);

    const updatedNotifications = {
      ...current?.notifications,
      ...notifications,
    };

    return updateUserPreferences(userId, {
      notifications: updatedNotifications,
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Reset preferences to defaults
 */
export async function resetUserPreferences(
  userId: string
): Promise<{ data: UserPreferences | null; error: Error | null }> {
  return updateUserPreferences(userId, DEFAULT_PREFERENCES);
}
