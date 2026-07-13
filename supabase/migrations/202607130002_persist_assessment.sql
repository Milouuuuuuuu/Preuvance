begin;

create function public.persist_completed_assessment(
  p_assessment_id uuid,
  p_organization_name text,
  p_system_name text,
  p_system_description text,
  p_sector text,
  p_source_description text,
  p_structured_facts jsonb,
  p_classification jsonb,
  p_gaps jsonb,
  p_report_payload jsonb,
  p_score smallint,
  p_tier text,
  p_reasoning_steps jsonb
)
returns table (assessment_id uuid, ai_system_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_organization_id uuid;
  current_system_id uuid;
  step jsonb;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select members.organization_id
  into current_organization_id
  from public.organization_members as members
  where members.user_id = current_user_id
  limit 1;

  if current_organization_id is null then
    raise exception 'organization membership required' using errcode = '42501';
  end if;

  if nullif(trim(p_organization_name), '') is null
    or char_length(trim(p_organization_name)) > 160 then
    raise exception 'invalid organization name' using errcode = '22023';
  end if;

  if nullif(trim(p_system_name), '') is null
    or char_length(trim(p_system_name)) > 160 then
    raise exception 'invalid AI system name' using errcode = '22023';
  end if;

  if jsonb_typeof(p_reasoning_steps) <> 'array' then
    raise exception 'reasoning steps must be a JSON array' using errcode = '22023';
  end if;

  update public.organizations
  set name = trim(p_organization_name)
  where id = current_organization_id;

  select systems.id
  into current_system_id
  from public.ai_systems as systems
  where systems.organization_id = current_organization_id
    and lower(systems.name) = lower(trim(p_system_name))
  order by systems.updated_at desc
  limit 1
  for update;

  if current_system_id is null then
    insert into public.ai_systems (
      organization_id,
      name,
      description,
      sector,
      created_by
    )
    values (
      current_organization_id,
      trim(p_system_name),
      p_system_description,
      nullif(trim(p_sector), ''),
      current_user_id
    )
    returning id into current_system_id;
  else
    update public.ai_systems
    set
      description = p_system_description,
      sector = nullif(trim(p_sector), '')
    where id = current_system_id;
  end if;

  insert into public.assessments (
    id,
    organization_id,
    ai_system_id,
    status,
    source_description,
    structured_facts,
    classification,
    gaps,
    report_payload,
    score,
    tier,
    created_by,
    completed_at
  )
  values (
    p_assessment_id,
    current_organization_id,
    current_system_id,
    'completed',
    p_source_description,
    p_structured_facts,
    p_classification,
    p_gaps,
    p_report_payload,
    p_score,
    p_tier,
    current_user_id,
    now()
  );

  for step in
    select value
    from jsonb_array_elements(p_reasoning_steps)
  loop
    insert into public.reasoning_steps (
      organization_id,
      assessment_id,
      sequence,
      stage,
      status,
      model,
      input,
      output,
      error_message,
      started_at,
      completed_at
    )
    values (
      current_organization_id,
      p_assessment_id,
      (step ->> 'sequence')::smallint,
      (step ->> 'stage')::public.reasoning_stage,
      (step ->> 'status')::public.reasoning_status,
      left(coalesce(nullif(step ->> 'model', ''), 'deterministic'), 120),
      step -> 'input',
      step -> 'output',
      nullif(step ->> 'error_message', ''),
      nullif(step ->> 'started_at', '')::timestamptz,
      nullif(step ->> 'completed_at', '')::timestamptz
    );
  end loop;

  return query select p_assessment_id, current_system_id;
end;
$$;

revoke all on function public.persist_completed_assessment(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  smallint,
  text,
  jsonb
) from public;

grant execute on function public.persist_completed_assessment(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  smallint,
  text,
  jsonb
) to authenticated;

commit;
