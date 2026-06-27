import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const supabase = createClient(
  "https://dvauueqtqrveqcckfrjx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YXV1ZXF0cXJ2ZXFjY2tmcmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTQ3NDMsImV4cCI6MjA4NzAzMDc0M30.Zpxj1of_wLzpqMDG72S00gpQPwi7kPpgrslcDfQXHV8",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
