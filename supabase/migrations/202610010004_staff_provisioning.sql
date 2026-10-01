BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_staff() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO public.profiles(id,email,display_name,role,active,must_change_password)
 VALUES(NEW.id,coalesce(NEW.email,''),coalesce(nullif(NEW.raw_user_meta_data->>'display_name',''),split_part(NEW.email,'@',1)),'cashier',false,true);
 RETURN NEW; END; $$;
COMMIT;
