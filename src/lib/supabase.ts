import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
export const SUPABASE_URL = 'https://eovjivdliqmvdhelgkfw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdmppdmRsaXFtdmRoZWxna2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTUxODUsImV4cCI6MjA5MDE3MTE4NX0.b1WBnP7Uuee0TPz6Oe7-4lpdwviOOaCF3Yox-zNOkM0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
