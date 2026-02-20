
-- Delete ALL dependent data for CAS001 restaurant
DELETE FROM public.temperature_logs WHERE location_id IN (
  SELECT id FROM public.temperature_locations WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3'
);
DELETE FROM public.temperature_locations WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.team_objectives WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.team_scores WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.task_templates WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.stock_logs WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.tasks WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.daily_menu_items WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.products WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.day_reports WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.shifts WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.incidents WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.gamification_settings WHERE restaurant_id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
DELETE FROM public.planning_shifts WHERE true;

-- Now delete the restaurant
DELETE FROM public.restaurants WHERE id = 'ec973cf7-663f-484e-a36c-ecc0fbac8ad3';
