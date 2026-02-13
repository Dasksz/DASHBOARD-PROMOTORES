-- ==============================================================================
-- FIX SIGNUP TRIGGER
-- This script updates the handle_new_user function to correctly populate
-- the profiles table with metadata sent during signup.
-- ==============================================================================

create or replace function public.handle_new_user () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
set
  search_path = public as $$
DECLARE
  v_name text;
  v_phone text;
  v_password text;
BEGIN
  -- Extract metadata
  v_name := new.raw_user_meta_data ->> 'full_name';
  v_phone := new.raw_user_meta_data ->> 'phone';
  v_password := new.raw_user_meta_data ->> 'password';

  -- Insert into profiles
  insert into public.profiles (id, email, status, role, name, phone, password)
  values (
    new.id,
    new.email,
    'pendente',
    'user',
    v_name,
    v_phone,
    v_password
  );

  return new;
end;
$$;
