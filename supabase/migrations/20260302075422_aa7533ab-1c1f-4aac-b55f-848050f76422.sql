-- Fix system room team_key to use existing FLOOR enum value
UPDATE public.rooms SET team_key = 'FLOOR' WHERE is_system = true AND team_key = 'MAIN_ROOM';
