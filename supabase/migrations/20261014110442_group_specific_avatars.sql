-- Per-membership cosmetic override. NULL continues to follow the main profile.
alter table public.group_memberships add column group_avatar_override text,
  add column group_avatar_appearance jsonb;

create function private.group_avatar_pack_key(p_avatar_id text)
returns text language sql immutable set search_path = '' as $$
  select pack_key from (values ('emoji_rocket','avatar_pack_1'),
('emoji_bolt','avatar_pack_1'),
('emoji_tiger','avatar_pack_1'),
('emoji_dragon','avatar_pack_1'),
('emoji_fire','avatar_pack_1'),
('emoji_star','avatar_pack_1'),
('vp_velocity_pulse','avatar_pack_2_velocity_pulse'),
('vp_focus_halo','avatar_pack_2_velocity_pulse'),
('vp_iron_shield','avatar_pack_2_velocity_pulse'),
('vp_streak_flame','avatar_pack_2_velocity_pulse'),
('vp_precision_target','avatar_pack_2_velocity_pulse'),
('vp_winged_sprint','avatar_pack_2_velocity_pulse'),
('ae_apex_runner','avatar_pack_3_apex_engine'),
('ae_neural_crown','avatar_pack_3_apex_engine'),
('ae_reactor_core','avatar_pack_3_apex_engine'),
('ae_vector_titan','avatar_pack_3_apex_engine'),
('ae_storm_circuit','avatar_pack_3_apex_engine'),
('ae_precision_orbit','avatar_pack_3_apex_engine'),
('ae_iron_mind','avatar_pack_3_apex_engine'),
('ae_momentum_drive','avatar_pack_3_apex_engine'),
('mm_velocity_runner','avatar_pack_4_movement_masters'),
('mm_iron_lifter','avatar_pack_4_movement_masters'),
('mm_aero_jumper','avatar_pack_4_movement_masters'),
('mm_shadow_striker','avatar_pack_4_movement_masters'),
('mm_endurance_titan','avatar_pack_4_movement_masters'),
('mm_blaze_sprinter','avatar_pack_4_movement_masters'),
('mm_storm_cycler','avatar_pack_4_movement_masters'),
('mm_focus_guardian','avatar_pack_4_movement_masters'),
('mg_storm_panther','avatar_pack_5_mythic_guardians'),
('mg_titan_rhino','avatar_pack_5_mythic_guardians'),
('mg_solar_falcon','avatar_pack_5_mythic_guardians'),
('mg_frost_wolf','avatar_pack_5_mythic_guardians'),
('mg_magma_gorilla','avatar_pack_5_mythic_guardians'),
('mg_atlas_guardian','avatar_pack_5_mythic_guardians'),
('mg_void_serpent','avatar_pack_5_mythic_guardians'),
('mg_aurora_stag','avatar_pack_5_mythic_guardians'),
('se_aero_cyclist','avatar_pack_6_sport_elites'),
('se_court_architect','avatar_pack_6_sport_elites'),
('se_endurance_phantom','avatar_pack_6_sport_elites'),
('se_hydro_blade','avatar_pack_6_sport_elites'),
('se_iron_operator','avatar_pack_6_sport_elites'),
('se_precision_fighter','avatar_pack_6_sport_elites'),
('se_rally_specialist','avatar_pack_6_sport_elites'),
('se_velocity_striker','avatar_pack_6_sport_elites'),
('ase_aero_cyclist_v2','avatar_pack_7_ascended_sport_elites'),
('ase_court_architect_v2','avatar_pack_7_ascended_sport_elites'),
('ase_endurance_phantom_v2','avatar_pack_7_ascended_sport_elites'),
('ase_hydro_blade_v2','avatar_pack_7_ascended_sport_elites'),
('ase_iron_operator_v2','avatar_pack_7_ascended_sport_elites'),
('ase_precision_fighter_v2','avatar_pack_7_ascended_sport_elites'),
('ase_rally_specialist_v2','avatar_pack_7_ascended_sport_elites'),
('ase_velocity_striker_v2','avatar_pack_7_ascended_sport_elites'),
('il_tech_sniper','avatar_pack_8_iconic_legends'),
('il_void_weaver','avatar_pack_8_iconic_legends'),
('il_frost_warden','avatar_pack_8_iconic_legends'),
('il_pyro_alchemist','avatar_pack_8_iconic_legends'),
('il_natures_whisper','avatar_pack_8_iconic_legends'),
('il_chrono_navigator','avatar_pack_8_iconic_legends'),
('il_electric_rogue','avatar_pack_8_iconic_legends'),
('il_bone_reaper','avatar_pack_8_iconic_legends'),
('il_gravity_monk','avatar_pack_9_iconic_legends2'),
('il_lunar_beastmaster','avatar_pack_9_iconic_legends2'),
('il_neon_samurai','avatar_pack_9_iconic_legends2'),
('il_plasma_engineer','avatar_pack_9_iconic_legends2'),
('il_rift-assassin','avatar_pack_9_iconic_legends2'),
('il_solar_paladin','avatar_pack_9_iconic_legends2'),
('il_storm_mechanic','avatar_pack_9_iconic_legends2'),
('il_venom-huntress','avatar_pack_9_iconic_legends2'),
('pa_velocity_ronin','avatar_pack_10_prestige_athletes'),
('pa_court_architect','avatar_pack_10_prestige_athletes'),
('pa_hydro_blade','avatar_pack_10_prestige_athletes'),
('pa_glacier_climber','avatar_pack_10_prestige_athletes'),
('pa_rugby_titan','avatar_pack_10_prestige_athletes'),
('pa_net_command','avatar_pack_10_prestige_athletes'),
('pa_field_dominator','avatar_pack_10_prestige_athletes'),
('pa_pitch_leader','avatar_pack_10_prestige_athletes'),
('p11_astro_sprout','avatar_pack_11_cosmic_sprouts'),
('p11_nebula_nib','avatar_pack_11_cosmic_sprouts'),
('p11_orbit_pop','avatar_pack_11_cosmic_sprouts'),
('p11_comet_bean','avatar_pack_11_cosmic_sprouts'),
('p11_zippy_quark','avatar_pack_11_cosmic_sprouts'),
('p11_luna_mite','avatar_pack_11_cosmic_sprouts'),
('p11_pulse_pix','avatar_pack_11_cosmic_sprouts'),
('p11_star_pogo','avatar_pack_11_cosmic_sprouts'),
('p12_bounce_bolt','avatar_pack_12_bounce_brigade'),
('p12_jelly_dash','avatar_pack_12_bounce_brigade'),
('p12_bean_blazer','avatar_pack_12_bounce_brigade'),
('p12_tumble_zap','avatar_pack_12_bounce_brigade'),
('p12_orbit_bop','avatar_pack_12_bounce_brigade'),
('p12_turbo_pip','avatar_pack_12_bounce_brigade'),
('p12_fizz_hopper','avatar_pack_12_bounce_brigade'),
('p12_pop_rocket','avatar_pack_12_bounce_brigade'),
('p13_rescue_rover','avatar_pack_13_rescue_legends'),
('p13_blaze_pup','avatar_pack_13_rescue_legends'),
('p13_turbo_terrier','avatar_pack_13_rescue_legends'),
('p13_sky_collie','avatar_pack_13_rescue_legends'),
('p13_patch_patrol','avatar_pack_13_rescue_legends'),
('p13_scout_shepherd','avatar_pack_13_rescue_legends'),
('p13_ember_hound','avatar_pack_13_rescue_legends'),
('p13_bolt_beagle','avatar_pack_13_rescue_legends'),
('p14_velvet_star','avatar_pack_14_velvet_icons'),
('p14_nova_chic','avatar_pack_14_velvet_icons'),
('p14_gloss_ace','avatar_pack_14_velvet_icons'),
('p14_luxe_dash','avatar_pack_14_velvet_icons'),
('p14_runway_rebel','avatar_pack_14_velvet_icons'),
('p14_satin_spark','avatar_pack_14_velvet_icons'),
('p14_gold_glider','avatar_pack_14_velvet_icons'),
('p14_prism_pop','avatar_pack_14_velvet_icons'),
('p15_neon_cipher','avatar_pack_15_neon_cipher_squad'),
('p15_pixel_viper','avatar_pack_15_neon_cipher_squad'),
('p15_circuit_jax','avatar_pack_15_neon_cipher_squad'),
('p15_pulse_nova','avatar_pack_15_neon_cipher_squad'),
('p15_vector_nyx','avatar_pack_15_neon_cipher_squad'),
('p15_chrome_flicker','avatar_pack_15_neon_cipher_squad'),
('p15_holo_dash','avatar_pack_15_neon_cipher_squad'),
('p15_byte_runner','avatar_pack_15_neon_cipher_squad'),
('p16_rocket_rumbler','avatar_pack_16_rocket_rumble_crew'),
('p16_nitro_fang','avatar_pack_16_rocket_rumble_crew'),
('p16_drift_brick','avatar_pack_16_rocket_rumble_crew'),
('p16_boost_bandit','avatar_pack_16_rocket_rumble_crew'),
('p16_turbo_tank','avatar_pack_16_rocket_rumble_crew'),
('p16_plasma_coupe','avatar_pack_16_rocket_rumble_crew'),
('p16_thunder_wagon','avatar_pack_16_rocket_rumble_crew'),
('p16_blaze_rocket','avatar_pack_16_rocket_rumble_crew'),
('p17_shadow_recon','avatar_pack_17_shadow_recon_unit'),
('p17_ghost_ranger','avatar_pack_17_shadow_recon_unit'),
('p17_stealth_vex','avatar_pack_17_shadow_recon_unit'),
('p17_night_scout','avatar_pack_17_shadow_recon_unit'),
('p17_echo_blade','avatar_pack_17_shadow_recon_unit'),
('p17_signal_hawk','avatar_pack_17_shadow_recon_unit'),
('p17_phantom_trace','avatar_pack_17_shadow_recon_unit'),
('p17_blackline','avatar_pack_17_shadow_recon_unit'),
('p18_tide_vanguard','avatar_pack_18_tide_vanguard_fleet'),
('p18_reef_marshal','avatar_pack_18_tide_vanguard_fleet'),
('p18_storm_diver','avatar_pack_18_tide_vanguard_fleet'),
('p18_harbor_sentinel','avatar_pack_18_tide_vanguard_fleet'),
('p18_breakwater','avatar_pack_18_tide_vanguard_fleet'),
('p18_blue_wake','avatar_pack_18_tide_vanguard_fleet'),
('p18_trident_ace','avatar_pack_18_tide_vanguard_fleet'),
('p18_saltstrike','avatar_pack_18_tide_vanguard_fleet'),
('p19_sky_marshal','avatar_pack_19_sky_marshal_wing'),
('p19_jetstream','avatar_pack_19_sky_marshal_wing'),
('p19_falcon_vector','avatar_pack_19_sky_marshal_wing'),
('p19_vapor_wing','avatar_pack_19_sky_marshal_wing'),
('p19_sonic_pilot','avatar_pack_19_sky_marshal_wing'),
('p19_cloudbreaker','avatar_pack_19_sky_marshal_wing'),
('p19_horizon_ace','avatar_pack_19_sky_marshal_wing'),
('p19_afterburn','avatar_pack_19_sky_marshal_wing'),
('p20_iron_revenant','avatar_pack_20_iron_revenants'),
('p20_steel_warden','avatar_pack_20_iron_revenants'),
('p20_core_hunter','avatar_pack_20_iron_revenants'),
('p20_volt_marauder','avatar_pack_20_iron_revenants'),
('p20_alloy_specter','avatar_pack_20_iron_revenants'),
('p20_titan_shade','avatar_pack_20_iron_revenants'),
('p20_chrome_reaper','avatar_pack_20_iron_revenants'),
('p20_rift_machine','avatar_pack_20_iron_revenants')) as avatars(avatar_id,pack_key) where avatar_id=p_avatar_id;
$$;
revoke all on function private.group_avatar_pack_key(text) from public, anon, authenticated;

create or replace function private.sync_group_cosmetics_from_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_avatar_id text; v_avatar_frame text; v_avatar_frames_enabled boolean;
begin
  if new.plan_json is not distinct from old.plan_json then return new; end if;
  v_avatar_id := coalesce(new.plan_json->'meta'->>'avatarId', '');
  v_avatar_frame := coalesce(new.plan_json->'meta'->>'avatarFrame', '');
  v_avatar_frames_enabled := case when jsonb_typeof(new.plan_json->'meta'->'avatarFramesEnabled')='boolean'
    then (new.plan_json->'meta'->>'avatarFramesEnabled')::boolean else true end;
  update public.group_memberships gm
    set avatar_id=coalesce(gm.group_avatar_override,v_avatar_id), avatar_frame=v_avatar_frame, avatar_frames_enabled=v_avatar_frames_enabled
    where gm.profile_id=new.id and gm.family_id=new.family_id and gm.status='active';
  return new;
end $$;

create or replace function private.sync_group_directory_avatar_appearance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_appearance jsonb;
begin
  select case when gm.group_avatar_override is not null then gm.group_avatar_appearance
    else p.plan_json->'meta'->'sportAvatarAppearance' end into v_appearance
  from public.group_memberships gm join public.profiles p on p.id=gm.profile_id where gm.id=new.membership_id;
  new.sport_avatar_appearance := case when v_appearance->>'edition'='paired_v2' and v_appearance->>'variant' in ('male','female')
    then jsonb_build_object('edition','paired_v2','variant',v_appearance->>'variant') else null end;
  return new;
end $$;

create function public.group_set_avatar(p_group_id uuid, p_profile_id uuid, p_avatar_id text default null, p_appearance jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_plan jsonb; v_member public.group_memberships%rowtype; v_avatar text:=nullif(btrim(p_avatar_id),''); v_pack text; v_appearance jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  -- Same owner/profile boundary and lock ordering as main-avatar changes.
  select p.plan_json into v_plan from public.profiles p join public.families f on f.id=p.family_id
    where p.id=p_profile_id and p.archived=false and f.owner_user_id=(select auth.uid()) for update of p;
  if not found then raise exception 'Profile not found' using errcode='42501'; end if;
  select * into v_member from public.group_memberships
    where group_id=p_group_id and profile_id=p_profile_id and status='active' for update;
  if not found then raise exception 'Active membership required' using errcode='42501'; end if;
  if v_avatar is not null then
    v_pack:=private.group_avatar_pack_key(v_avatar);
    if not (
      (v_pack is not null and coalesce(v_plan->'meta'->'unlockedAvatarPacks','[]'::jsonb) ? v_pack)
      or (v_avatar ~ '^sport_avatar_[a-z_]+_(bronze|silver|gold|platinum|diamond|elite|champion|unreal)$' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_plan->'meta'->'claimedRewards')='array' then v_plan->'meta'->'claimedRewards' else '[]'::jsonb end) claim
        where claim->>'key'=v_avatar or claim=to_jsonb(v_avatar)))
    ) then raise exception 'Unlock and claim this avatar in Rewards first' using errcode='42501'; end if;
    if p_appearance is not null and p_appearance <> 'null'::jsonb then
      if v_avatar not like 'sport_avatar_%' or p_appearance->>'edition' is distinct from 'paired_v2'
        or coalesce(p_appearance->>'variant','') not in ('male','female') then
        raise exception 'Invalid avatar appearance' using errcode='22023';
      end if;
      v_appearance:=jsonb_build_object('edition','paired_v2','variant',p_appearance->>'variant');
    end if;
  end if;
  update public.group_memberships set group_avatar_override=v_avatar, group_avatar_appearance=v_appearance,
    avatar_id=coalesce(v_avatar,v_plan->'meta'->>'avatarId','') where id=v_member.id;
  return jsonb_build_object('membership_id',v_member.id,'avatar_id',coalesce(v_avatar,v_plan->'meta'->>'avatarId',''),'group_avatar_override',v_avatar);
end $$;
revoke all on function public.group_set_avatar(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.group_set_avatar(uuid,uuid,text,jsonb) to authenticated;
