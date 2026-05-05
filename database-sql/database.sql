--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.0

-- Started on 2026-05-05 15:46:43

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 97 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4036 (class 0 OID 0)
-- Dependencies: 97
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 506 (class 1255 OID 23339)
-- Name: emit_app_event(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.emit_app_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_zapisa bigint;
    v_tip_dogadjaja text;
    v_treba_pisati boolean := true;
BEGIN
    v_id_zapisa := COALESCE(NEW.id, OLD.id);

    CASE TG_TABLE_NAME
        WHEN 'evidencija_goriva' THEN
            v_tip_dogadjaja := 'unos_goriva';

        -- Ovdje smo zamijenili staru tablicu novom
        WHEN 'servisne_intervencije' THEN
            IF TG_OP = 'INSERT' THEN
                v_tip_dogadjaja := 'nova_prijava_kvara';
            ELSIF TG_OP = 'UPDATE' AND OLD.status_prijave IS DISTINCT FROM NEW.status_prijave THEN
                -- Možeš dodati specifičan event ako je status 'Završeno'
                IF NEW.status_prijave = 'Zatvoreno' THEN
                    v_tip_dogadjaja := 'servis_zavrsen';
                ELSE
                    v_tip_dogadjaja := 'status_promjena';
                END IF;
            ELSE
                v_treba_pisati := false;
            END IF;

        WHEN 'zaduzenja' THEN
            IF TG_OP = 'INSERT' THEN
                v_tip_dogadjaja := 'novo_zaduzenje';
            ELSIF TG_OP = 'UPDATE' AND OLD.is_aktivno = true AND NEW.is_aktivno = false THEN
                v_tip_dogadjaja := 'razduzenje';
            ELSE
                v_treba_pisati := false;
            END IF;
        ELSE
            v_treba_pisati := false;
    END CASE;

    IF v_treba_pisati THEN
        INSERT INTO public.app_events (tip_dogadjaja, izvorna_tablica, operacija, id_zapisa)
        VALUES (v_tip_dogadjaja, TG_TABLE_NAME, TG_OP, v_id_zapisa);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.emit_app_event() OWNER TO postgres;

--
-- TOC entry 479 (class 1255 OID 17162)
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 388 (class 1259 OID 23325)
-- Name: app_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_events (
    id bigint NOT NULL,
    tip_dogadjaja text NOT NULL,
    izvorna_tablica text NOT NULL,
    operacija text NOT NULL,
    id_zapisa bigint,
    kreirano_u timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_events_event_type_chk CHECK ((tip_dogadjaja = ANY (ARRAY['unos_goriva'::text, 'nova_prijava_kvara'::text, 'status_promjena'::text, 'novo_zaduzenje'::text, 'razduzenje'::text, 'fuel_changed'::text, 'fault_changed'::text, 'assignment_changed'::text]))),
    CONSTRAINT app_events_operation_chk CHECK ((operacija = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text]))),
    CONSTRAINT app_events_source_table_chk CHECK ((izvorna_tablica = ANY (ARRAY['evidencija_goriva'::text, 'servisne_intervencije'::text, 'zaduzenja'::text, 'vozila'::text])))
);


ALTER TABLE public.app_events OWNER TO postgres;

--
-- TOC entry 387 (class 1259 OID 23324)
-- Name: app_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.app_events ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.app_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 354 (class 1259 OID 20543)
-- Name: drzave; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drzave (
    id integer NOT NULL,
    naziv character varying(50) NOT NULL
);


ALTER TABLE public.drzave OWNER TO postgres;

--
-- TOC entry 353 (class 1259 OID 20542)
-- Name: drzave_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.drzave ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.drzave_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 384 (class 1259 OID 20734)
-- Name: evidencija_goriva; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidencija_goriva (
    id integer NOT NULL,
    zaduzenje_id integer,
    datum timestamp without time zone DEFAULT now() NOT NULL,
    litraza numeric(7,2) NOT NULL,
    cijena_po_litri numeric(5,2) NOT NULL,
    km_tocenja integer NOT NULL,
    ukupni_iznos numeric(10,2) GENERATED ALWAYS AS ((litraza * cijena_po_litri)) STORED
);


ALTER TABLE public.evidencija_goriva OWNER TO postgres;

--
-- TOC entry 383 (class 1259 OID 20733)
-- Name: evidencija_goriva_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.evidencija_goriva ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.evidencija_goriva_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 386 (class 1259 OID 20747)
-- Name: evidencija_guma; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidencija_guma (
    id integer NOT NULL,
    vozilo_id integer,
    sezona character varying(20),
    proizvodjac character varying(50),
    datum_kupovine date DEFAULT CURRENT_DATE,
    cijena numeric(10,2)
);


ALTER TABLE public.evidencija_guma OWNER TO postgres;

--
-- TOC entry 385 (class 1259 OID 20746)
-- Name: evidencija_guma_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.evidencija_guma ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.evidencija_guma_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 370 (class 1259 OID 20601)
-- Name: kategorije_kvarova; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kategorije_kvarova (
    id integer NOT NULL,
    naziv character varying(50) NOT NULL
);


ALTER TABLE public.kategorije_kvarova OWNER TO postgres;

--
-- TOC entry 369 (class 1259 OID 20600)
-- Name: kategorije_kvarova_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.kategorije_kvarova ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.kategorije_kvarova_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 364 (class 1259 OID 20583)
-- Name: kategorije_vozila; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kategorije_vozila (
    id integer NOT NULL,
    naziv character varying(50) NOT NULL
);


ALTER TABLE public.kategorije_vozila OWNER TO postgres;

--
-- TOC entry 363 (class 1259 OID 20582)
-- Name: kategorije_vozila_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.kategorije_vozila ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.kategorije_vozila_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 358 (class 1259 OID 20560)
-- Name: mjesta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mjesta (
    id integer NOT NULL,
    naziv character varying(100) NOT NULL,
    zupanija_id integer
);


ALTER TABLE public.mjesta OWNER TO postgres;

--
-- TOC entry 357 (class 1259 OID 20559)
-- Name: mjesta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.mjesta ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mjesta_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 372 (class 1259 OID 20607)
-- Name: modeli; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modeli (
    id integer NOT NULL,
    naziv character varying(100) NOT NULL,
    proizvodjac_id integer,
    kategorija_id integer,
    tip_goriva_id integer,
    kapacitet_rezervoara numeric(5,2),
    mali_servis_interval_km integer DEFAULT 15000,
    veliki_servis_interval_km integer DEFAULT 100000
);


ALTER TABLE public.modeli OWNER TO postgres;

--
-- TOC entry 371 (class 1259 OID 20606)
-- Name: modeli_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.modeli ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.modeli_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 362 (class 1259 OID 20577)
-- Name: proizvodjaci; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proizvodjaci (
    id integer NOT NULL,
    naziv character varying(50) NOT NULL
);


ALTER TABLE public.proizvodjaci OWNER TO postgres;

--
-- TOC entry 361 (class 1259 OID 20576)
-- Name: proizvodjaci_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.proizvodjaci ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.proizvodjaci_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 380 (class 1259 OID 20694)
-- Name: registracije; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registracije (
    id integer NOT NULL,
    vozilo_id integer,
    registracijska_oznaka character varying(20) NOT NULL,
    datum_registracije date NOT NULL,
    datum_isteka date NOT NULL,
    cijena numeric(10,2)
);


ALTER TABLE public.registracije OWNER TO postgres;

--
-- TOC entry 379 (class 1259 OID 20693)
-- Name: registracije_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.registracije ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.registracije_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 382 (class 1259 OID 20705)
-- Name: servisne_intervencije; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servisne_intervencije (
    id integer NOT NULL,
    vozilo_id integer,
    datum_pocetka timestamp without time zone DEFAULT now() NOT NULL,
    datum_zavrsetka timestamp without time zone,
    km_u_tom_trenutku integer NOT NULL,
    cijena numeric(10,2),
    opis text,
    kategorija_id integer,
    zaposlenik_id integer,
    hitnost text,
    status_prijave text DEFAULT 'novo'::text,
    attachment_url text
);


ALTER TABLE public.servisne_intervencije OWNER TO postgres;

--
-- TOC entry 381 (class 1259 OID 20704)
-- Name: servisne_intervencije_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.servisne_intervencije ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.servisne_intervencije_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 368 (class 1259 OID 20595)
-- Name: statusi_vozila; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.statusi_vozila (
    id integer NOT NULL,
    naziv character varying(30) NOT NULL
);


ALTER TABLE public.statusi_vozila OWNER TO postgres;

--
-- TOC entry 367 (class 1259 OID 20594)
-- Name: statusi_vozila_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.statusi_vozila ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.statusi_vozila_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 366 (class 1259 OID 20589)
-- Name: tipovi_goriva; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tipovi_goriva (
    id integer NOT NULL,
    naziv character varying(30) NOT NULL
);


ALTER TABLE public.tipovi_goriva OWNER TO postgres;

--
-- TOC entry 365 (class 1259 OID 20588)
-- Name: tipovi_goriva_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.tipovi_goriva ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tipovi_goriva_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 360 (class 1259 OID 20571)
-- Name: uloge; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uloge (
    id integer NOT NULL,
    naziv character varying(50) NOT NULL
);


ALTER TABLE public.uloge OWNER TO postgres;

--
-- TOC entry 359 (class 1259 OID 20570)
-- Name: uloge_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.uloge ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.uloge_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 374 (class 1259 OID 20630)
-- Name: vozila; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vozila (
    id integer NOT NULL,
    model_id integer,
    status_id integer,
    mjesto_id integer,
    broj_sasije character varying(50) NOT NULL,
    godina_proizvodnje integer,
    datum_kupovine date,
    nabavna_vrijednost numeric(10,2),
    trenutna_km integer DEFAULT 0,
    zadnji_mali_servis_km integer DEFAULT 0,
    zadnji_veliki_servis_km integer DEFAULT 0,
    zadnji_mali_servis_datum date,
    zadnji_veliki_servis_datum date,
    is_aktivan boolean DEFAULT true,
    razlog_deaktivacije text
);


ALTER TABLE public.vozila OWNER TO postgres;

--
-- TOC entry 373 (class 1259 OID 20629)
-- Name: vozila_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.vozila ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.vozila_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 378 (class 1259 OID 20676)
-- Name: zaduzenja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zaduzenja (
    id integer NOT NULL,
    vozilo_id integer,
    zaposlenik_id integer,
    datum_od timestamp without time zone DEFAULT now() NOT NULL,
    datum_do timestamp without time zone,
    km_pocetna integer NOT NULL,
    km_zavrsna integer,
    is_aktivno boolean DEFAULT true
);


ALTER TABLE public.zaduzenja OWNER TO postgres;

--
-- TOC entry 377 (class 1259 OID 20675)
-- Name: zaduzenja_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.zaduzenja ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.zaduzenja_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 376 (class 1259 OID 20656)
-- Name: zaposlenici; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zaposlenici (
    id integer NOT NULL,
    ime character varying(50) NOT NULL,
    prezime character varying(50) NOT NULL,
    korisnicko_ime character varying(50) NOT NULL,
    lozinka text NOT NULL,
    uloga_id integer,
    mjesto_id integer,
    email text,
    pozivnica_token text,
    pozivnica_vrijedi_do timestamp with time zone,
    is_aktivan boolean DEFAULT true,
    razlog_deaktivacije text
);


ALTER TABLE public.zaposlenici OWNER TO postgres;

--
-- TOC entry 375 (class 1259 OID 20655)
-- Name: zaposlenici_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.zaposlenici ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.zaposlenici_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 356 (class 1259 OID 20549)
-- Name: zupanije; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zupanije (
    id integer NOT NULL,
    naziv character varying(100) NOT NULL,
    drzava_id integer
);


ALTER TABLE public.zupanije OWNER TO postgres;

--
-- TOC entry 355 (class 1259 OID 20548)
-- Name: zupanije_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.zupanije ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.zupanije_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 4030 (class 0 OID 23325)
-- Dependencies: 388
-- Data for Name: app_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_events (id, tip_dogadjaja, izvorna_tablica, operacija, id_zapisa, kreirano_u) FROM stdin;
2	unos_goriva	evidencija_goriva	INSERT	37	2026-03-30 16:46:30.887019+00
1342	unos_goriva	evidencija_goriva	UPDATE	49	2026-04-13 14:06:47.431729+00
1343	unos_goriva	evidencija_goriva	UPDATE	50	2026-04-13 14:06:47.431729+00
1344	unos_goriva	evidencija_goriva	UPDATE	51	2026-04-13 14:06:47.431729+00
1345	unos_goriva	evidencija_goriva	UPDATE	52	2026-04-13 14:06:47.431729+00
1346	unos_goriva	evidencija_goriva	UPDATE	53	2026-04-13 14:06:47.431729+00
8	novo_zaduzenje	zaduzenja	INSERT	71	2026-03-31 08:29:15.802293+00
9	razduzenje	zaduzenja	UPDATE	71	2026-03-31 08:29:20.744182+00
10	novo_zaduzenje	zaduzenja	INSERT	72	2026-03-31 08:34:42.682662+00
1347	unos_goriva	evidencija_goriva	UPDATE	54	2026-04-13 14:06:47.431729+00
1348	unos_goriva	evidencija_goriva	UPDATE	55	2026-04-13 14:06:47.431729+00
1349	unos_goriva	evidencija_goriva	UPDATE	56	2026-04-13 14:06:47.431729+00
1350	unos_goriva	evidencija_goriva	UPDATE	57	2026-04-13 14:06:47.431729+00
1351	unos_goriva	evidencija_goriva	UPDATE	58	2026-04-13 14:06:47.431729+00
1352	unos_goriva	evidencija_goriva	UPDATE	59	2026-04-13 14:06:47.431729+00
1353	unos_goriva	evidencija_goriva	UPDATE	60	2026-04-13 14:06:47.431729+00
1354	unos_goriva	evidencija_goriva	UPDATE	61	2026-04-13 14:06:47.431729+00
19	razduzenje	zaduzenja	UPDATE	36	2026-03-31 19:59:47.298029+00
20	novo_zaduzenje	zaduzenja	INSERT	73	2026-03-31 19:59:55.398317+00
21	razduzenje	zaduzenja	UPDATE	73	2026-03-31 19:59:58.692445+00
1355	unos_goriva	evidencija_goriva	UPDATE	62	2026-04-13 14:06:47.431729+00
1356	unos_goriva	evidencija_goriva	UPDATE	63	2026-04-13 14:06:47.431729+00
1357	unos_goriva	evidencija_goriva	UPDATE	64	2026-04-13 14:06:47.431729+00
1358	unos_goriva	evidencija_goriva	UPDATE	65	2026-04-13 14:06:47.431729+00
1359	unos_goriva	evidencija_goriva	UPDATE	66	2026-04-13 14:06:47.431729+00
27	novo_zaduzenje	zaduzenja	INSERT	74	2026-03-31 20:30:45.416348+00
28	razduzenje	zaduzenja	UPDATE	74	2026-03-31 20:30:47.365408+00
29	novo_zaduzenje	zaduzenja	INSERT	75	2026-03-31 20:32:12.046908+00
30	razduzenje	zaduzenja	UPDATE	75	2026-03-31 20:32:13.30894+00
31	novo_zaduzenje	zaduzenja	INSERT	76	2026-03-31 20:34:39.509521+00
32	razduzenje	zaduzenja	UPDATE	76	2026-03-31 20:34:41.368602+00
1360	unos_goriva	evidencija_goriva	UPDATE	67	2026-04-13 14:06:47.431729+00
1361	unos_goriva	evidencija_goriva	UPDATE	68	2026-04-13 14:06:47.431729+00
35	novo_zaduzenje	zaduzenja	INSERT	77	2026-03-31 20:38:13.72881+00
36	razduzenje	zaduzenja	UPDATE	77	2026-03-31 20:38:15.695163+00
37	novo_zaduzenje	zaduzenja	INSERT	78	2026-03-31 20:38:28.192893+00
38	razduzenje	zaduzenja	UPDATE	78	2026-03-31 20:38:29.817162+00
39	novo_zaduzenje	zaduzenja	INSERT	79	2026-03-31 20:41:36.900295+00
40	razduzenje	zaduzenja	UPDATE	79	2026-03-31 20:41:40.565724+00
41	novo_zaduzenje	zaduzenja	INSERT	80	2026-03-31 20:42:07.766656+00
42	razduzenje	zaduzenja	UPDATE	80	2026-03-31 20:42:10.236727+00
43	novo_zaduzenje	zaduzenja	INSERT	81	2026-03-31 20:42:40.165215+00
44	razduzenje	zaduzenja	UPDATE	81	2026-03-31 20:42:42.790907+00
45	novo_zaduzenje	zaduzenja	INSERT	82	2026-03-31 20:46:08.662103+00
46	razduzenje	zaduzenja	UPDATE	82	2026-03-31 20:46:10.178067+00
47	novo_zaduzenje	zaduzenja	INSERT	83	2026-03-31 20:46:52.040532+00
48	razduzenje	zaduzenja	UPDATE	83	2026-03-31 20:47:12.014325+00
49	novo_zaduzenje	zaduzenja	INSERT	84	2026-03-31 20:49:09.89056+00
50	razduzenje	zaduzenja	UPDATE	84	2026-03-31 20:49:12.150757+00
51	novo_zaduzenje	zaduzenja	INSERT	85	2026-03-31 20:51:36.348132+00
52	razduzenje	zaduzenja	UPDATE	85	2026-03-31 20:51:38.357445+00
53	novo_zaduzenje	zaduzenja	INSERT	86	2026-03-31 20:55:20.900208+00
54	razduzenje	zaduzenja	UPDATE	86	2026-03-31 20:55:22.824678+00
55	novo_zaduzenje	zaduzenja	INSERT	87	2026-03-31 20:55:58.973518+00
56	unos_goriva	evidencija_goriva	INSERT	38	2026-03-31 20:56:07.273969+00
57	razduzenje	zaduzenja	UPDATE	87	2026-03-31 20:56:10.075753+00
58	novo_zaduzenje	zaduzenja	INSERT	88	2026-03-31 21:05:30.449787+00
59	razduzenje	zaduzenja	UPDATE	88	2026-03-31 21:05:33.59895+00
60	novo_zaduzenje	zaduzenja	INSERT	89	2026-03-31 21:06:10.862316+00
1362	unos_goriva	evidencija_goriva	UPDATE	69	2026-04-13 14:06:47.431729+00
1363	unos_goriva	evidencija_goriva	UPDATE	70	2026-04-13 14:06:47.431729+00
1364	unos_goriva	evidencija_goriva	UPDATE	71	2026-04-13 14:06:47.431729+00
64	unos_goriva	evidencija_goriva	INSERT	39	2026-03-31 22:36:49.097974+00
65	unos_goriva	evidencija_goriva	INSERT	40	2026-03-31 22:37:15.506671+00
66	unos_goriva	evidencija_goriva	INSERT	41	2026-03-31 22:37:29.058185+00
67	razduzenje	zaduzenja	UPDATE	50	2026-03-31 22:37:31.081738+00
68	novo_zaduzenje	zaduzenja	INSERT	90	2026-03-31 22:37:40.028283+00
69	razduzenje	zaduzenja	UPDATE	90	2026-03-31 22:37:44.906056+00
70	novo_zaduzenje	zaduzenja	INSERT	91	2026-03-31 22:38:03.306329+00
71	unos_goriva	evidencija_goriva	INSERT	42	2026-03-31 22:38:12.451282+00
72	razduzenje	zaduzenja	UPDATE	91	2026-03-31 22:38:14.504382+00
1365	unos_goriva	evidencija_goriva	UPDATE	72	2026-04-13 14:06:47.431729+00
1366	unos_goriva	evidencija_goriva	UPDATE	73	2026-04-13 14:06:47.431729+00
1367	unos_goriva	evidencija_goriva	UPDATE	74	2026-04-13 14:06:47.431729+00
1368	unos_goriva	evidencija_goriva	UPDATE	75	2026-04-13 14:06:47.431729+00
1369	unos_goriva	evidencija_goriva	UPDATE	76	2026-04-13 14:06:47.431729+00
1370	unos_goriva	evidencija_goriva	UPDATE	77	2026-04-13 14:06:47.431729+00
79	novo_zaduzenje	zaduzenja	INSERT	92	2026-03-31 23:55:21.694158+00
3	nova_prijava_kvara	servisne_intervencije	INSERT	29	2026-03-30 16:46:59.248713+00
4	status_promjena	servisne_intervencije	UPDATE	8	2026-03-30 18:36:55.841873+00
5	status_promjena	servisne_intervencije	UPDATE	8	2026-03-30 18:36:59.910341+00
6	status_promjena	servisne_intervencije	UPDATE	8	2026-03-30 18:37:01.7936+00
7	status_promjena	servisne_intervencije	UPDATE	8	2026-03-30 18:37:03.274016+00
11	status_promjena	servisne_intervencije	UPDATE	25	2026-03-31 16:09:59.17271+00
12	status_promjena	servisne_intervencije	UPDATE	27	2026-03-31 16:10:54.248799+00
13	status_promjena	servisne_intervencije	UPDATE	21	2026-03-31 18:10:32.499047+00
14	status_promjena	servisne_intervencije	UPDATE	26	2026-03-31 18:12:46.877281+00
15	status_promjena	servisne_intervencije	UPDATE	26	2026-03-31 18:12:55.519287+00
16	status_promjena	servisne_intervencije	UPDATE	20	2026-03-31 18:47:07.020521+00
17	status_promjena	servisne_intervencije	UPDATE	19	2026-03-31 18:57:05.920081+00
1371	unos_goriva	evidencija_goriva	UPDATE	78	2026-04-13 14:06:47.431729+00
18	status_promjena	servisne_intervencije	UPDATE	29	2026-03-31 18:57:12.026072+00
22	nova_prijava_kvara	servisne_intervencije	INSERT	30	2026-03-31 20:27:57.013647+00
23	nova_prijava_kvara	servisne_intervencije	INSERT	31	2026-03-31 20:27:57.191524+00
24	status_promjena	servisne_intervencije	UPDATE	31	2026-03-31 20:29:10.284293+00
25	status_promjena	servisne_intervencije	UPDATE	30	2026-03-31 20:29:19.796754+00
26	status_promjena	servisne_intervencije	UPDATE	29	2026-03-31 20:29:42.869824+00
33	status_promjena	servisne_intervencije	UPDATE	31	2026-03-31 20:35:47.357379+00
34	status_promjena	servisne_intervencije	UPDATE	31	2026-03-31 20:36:34.573773+00
61	nova_prijava_kvara	servisne_intervencije	INSERT	32	2026-03-31 22:34:16.694471+00
62	status_promjena	servisne_intervencije	UPDATE	32	2026-03-31 22:34:21.301477+00
63	status_promjena	servisne_intervencije	UPDATE	32	2026-03-31 22:34:27.3248+00
73	nova_prijava_kvara	servisne_intervencije	INSERT	33	2026-03-31 22:38:14.955551+00
74	status_promjena	servisne_intervencije	UPDATE	33	2026-03-31 22:41:45.717058+00
75	status_promjena	servisne_intervencije	UPDATE	33	2026-03-31 22:42:04.257833+00
76	status_promjena	servisne_intervencije	UPDATE	24	2026-03-31 22:49:53.530043+00
77	status_promjena	servisne_intervencije	UPDATE	23	2026-03-31 22:49:54.480866+00
78	status_promjena	servisne_intervencije	UPDATE	28	2026-03-31 22:49:55.14962+00
81	nova_prijava_kvara	servisne_intervencije	INSERT	35	2026-03-31 23:58:55.826446+00
82	razduzenje	zaduzenja	UPDATE	92	2026-03-31 23:59:15.126711+00
83	novo_zaduzenje	zaduzenja	INSERT	93	2026-03-31 23:59:48.919738+00
84	razduzenje	zaduzenja	UPDATE	93	2026-03-31 23:59:52.694116+00
85	novo_zaduzenje	zaduzenja	INSERT	94	2026-03-31 23:59:58.611811+00
86	unos_goriva	evidencija_goriva	INSERT	43	2026-04-01 00:00:11.742702+00
87	razduzenje	zaduzenja	UPDATE	94	2026-04-01 00:00:16.045048+00
88	novo_zaduzenje	zaduzenja	INSERT	95	2026-04-01 00:00:21.689963+00
89	nova_prijava_kvara	servisne_intervencije	INSERT	36	2026-04-01 00:00:47.82751+00
90	razduzenje	zaduzenja	UPDATE	95	2026-04-01 00:00:58.144414+00
91	status_promjena	servisne_intervencije	UPDATE	36	2026-04-01 00:02:29.23087+00
92	status_promjena	servisne_intervencije	UPDATE	35	2026-04-01 00:02:36.443024+00
93	status_promjena	servisne_intervencije	UPDATE	33	2026-04-01 00:02:45.028076+00
94	status_promjena	servisne_intervencije	UPDATE	32	2026-04-01 00:03:27.364116+00
95	status_promjena	servisne_intervencije	UPDATE	30	2026-04-01 00:03:35.522293+00
96	status_promjena	servisne_intervencije	UPDATE	29	2026-04-01 00:03:38.078383+00
97	status_promjena	servisne_intervencije	UPDATE	25	2026-04-01 00:03:41.133387+00
98	status_promjena	servisne_intervencije	UPDATE	24	2026-04-01 00:03:44.761295+00
99	status_promjena	servisne_intervencije	UPDATE	23	2026-04-01 00:03:47.77594+00
100	status_promjena	servisne_intervencije	UPDATE	22	2026-04-01 00:03:51.47304+00
101	status_promjena	servisne_intervencije	UPDATE	21	2026-04-01 00:03:55.80766+00
102	status_promjena	servisne_intervencije	UPDATE	20	2026-04-01 00:03:59.040104+00
103	status_promjena	servisne_intervencije	UPDATE	19	2026-04-01 00:04:01.95019+00
104	status_promjena	servisne_intervencije	UPDATE	18	2026-04-01 00:04:17.967638+00
105	status_promjena	servisne_intervencije	UPDATE	17	2026-04-01 00:04:25.213305+00
106	status_promjena	servisne_intervencije	UPDATE	27	2026-04-01 00:04:35.509533+00
107	status_promjena	servisne_intervencije	UPDATE	15	2026-04-01 00:04:49.772868+00
108	status_promjena	servisne_intervencije	UPDATE	14	2026-04-01 00:04:52.992343+00
109	status_promjena	servisne_intervencije	UPDATE	13	2026-04-01 00:04:58.083492+00
110	status_promjena	servisne_intervencije	UPDATE	12	2026-04-01 00:05:01.422682+00
111	status_promjena	servisne_intervencije	UPDATE	11	2026-04-01 00:05:06.287618+00
112	status_promjena	servisne_intervencije	UPDATE	10	2026-04-01 00:05:12.229956+00
113	status_promjena	servisne_intervencije	UPDATE	9	2026-04-01 00:05:17.98711+00
114	status_promjena	servisne_intervencije	UPDATE	8	2026-04-01 00:05:23.120367+00
115	status_promjena	servisne_intervencije	UPDATE	35	2026-04-01 14:15:54.469009+00
116	status_promjena	servisne_intervencije	UPDATE	35	2026-04-01 15:16:47.158021+00
117	status_promjena	servisne_intervencije	UPDATE	35	2026-04-01 15:19:10.342906+00
118	status_promjena	servisne_intervencije	UPDATE	35	2026-04-01 15:19:12.381838+00
119	status_promjena	servisne_intervencije	UPDATE	2	2026-04-11 13:41:17.958376+00
120	status_promjena	servisne_intervencije	UPDATE	2	2026-04-11 14:29:57.187771+00
121	nova_prijava_kvara	servisne_intervencije	INSERT	37	2026-04-11 14:30:29.273664+00
122	nova_prijava_kvara	servisne_intervencije	INSERT	38	2026-04-11 14:33:43.577723+00
123	razduzenje	zaduzenja	UPDATE	89	2026-04-11 14:54:49.179999+00
124	novo_zaduzenje	zaduzenja	INSERT	96	2026-04-11 14:55:11.564259+00
125	unos_goriva	evidencija_goriva	INSERT	44	2026-04-11 16:06:19.683059+00
126	unos_goriva	evidencija_goriva	INSERT	45	2026-04-11 16:12:35.266712+00
127	status_promjena	servisne_intervencije	UPDATE	4	2026-04-11 17:33:05.097891+00
128	status_promjena	servisne_intervencije	UPDATE	1	2026-04-11 17:33:05.476216+00
129	status_promjena	servisne_intervencije	UPDATE	4	2026-04-11 19:41:12.188102+00
130	nova_prijava_kvara	servisne_intervencije	INSERT	39	2026-04-11 19:42:54.453314+00
131	status_promjena	servisne_intervencije	UPDATE	39	2026-04-11 19:43:09.313096+00
132	nova_prijava_kvara	servisne_intervencije	INSERT	40	2026-04-12 09:50:07.28492+00
133	status_promjena	servisne_intervencije	UPDATE	40	2026-04-12 09:52:03.626884+00
134	status_promjena	servisne_intervencije	UPDATE	1	2026-04-12 09:52:24.278493+00
135	unos_goriva	evidencija_goriva	INSERT	46	2026-04-12 10:10:54.803407+00
136	razduzenje	zaduzenja	UPDATE	96	2026-04-12 10:16:23.414383+00
137	novo_zaduzenje	zaduzenja	INSERT	97	2026-04-12 10:27:20.134005+00
138	unos_goriva	evidencija_goriva	INSERT	47	2026-04-12 10:28:10.329259+00
139	unos_goriva	evidencija_goriva	INSERT	48	2026-04-12 10:29:55.197057+00
140	razduzenje	zaduzenja	UPDATE	34	2026-04-12 10:40:30.886837+00
141	status_promjena	servisne_intervencije	UPDATE	2	2026-04-12 10:43:05.740718+00
142	novo_zaduzenje	zaduzenja	INSERT	98	2026-04-13 13:43:42.208896+00
143	novo_zaduzenje	zaduzenja	INSERT	99	2026-04-13 13:43:42.208896+00
144	novo_zaduzenje	zaduzenja	INSERT	100	2026-04-13 13:43:42.208896+00
145	novo_zaduzenje	zaduzenja	INSERT	101	2026-04-13 13:43:42.208896+00
146	novo_zaduzenje	zaduzenja	INSERT	102	2026-04-13 13:43:42.208896+00
147	novo_zaduzenje	zaduzenja	INSERT	103	2026-04-13 13:43:42.208896+00
148	novo_zaduzenje	zaduzenja	INSERT	104	2026-04-13 13:43:42.208896+00
149	novo_zaduzenje	zaduzenja	INSERT	105	2026-04-13 13:43:42.208896+00
150	novo_zaduzenje	zaduzenja	INSERT	106	2026-04-13 13:43:42.208896+00
151	novo_zaduzenje	zaduzenja	INSERT	107	2026-04-13 13:43:42.208896+00
152	novo_zaduzenje	zaduzenja	INSERT	108	2026-04-13 13:43:42.208896+00
153	novo_zaduzenje	zaduzenja	INSERT	109	2026-04-13 13:43:42.208896+00
154	novo_zaduzenje	zaduzenja	INSERT	110	2026-04-13 13:43:42.208896+00
155	novo_zaduzenje	zaduzenja	INSERT	111	2026-04-13 13:43:42.208896+00
156	novo_zaduzenje	zaduzenja	INSERT	112	2026-04-13 13:43:42.208896+00
157	novo_zaduzenje	zaduzenja	INSERT	113	2026-04-13 13:43:42.208896+00
158	novo_zaduzenje	zaduzenja	INSERT	114	2026-04-13 13:43:42.208896+00
159	novo_zaduzenje	zaduzenja	INSERT	115	2026-04-13 13:43:42.208896+00
160	novo_zaduzenje	zaduzenja	INSERT	116	2026-04-13 13:43:42.208896+00
161	novo_zaduzenje	zaduzenja	INSERT	117	2026-04-13 13:43:42.208896+00
162	novo_zaduzenje	zaduzenja	INSERT	118	2026-04-13 13:43:42.208896+00
163	novo_zaduzenje	zaduzenja	INSERT	119	2026-04-13 13:43:42.208896+00
164	novo_zaduzenje	zaduzenja	INSERT	120	2026-04-13 13:43:42.208896+00
165	novo_zaduzenje	zaduzenja	INSERT	121	2026-04-13 13:43:42.208896+00
166	novo_zaduzenje	zaduzenja	INSERT	122	2026-04-13 13:43:42.208896+00
167	novo_zaduzenje	zaduzenja	INSERT	123	2026-04-13 13:43:42.208896+00
168	novo_zaduzenje	zaduzenja	INSERT	124	2026-04-13 13:43:42.208896+00
169	novo_zaduzenje	zaduzenja	INSERT	125	2026-04-13 13:43:42.208896+00
170	novo_zaduzenje	zaduzenja	INSERT	126	2026-04-13 13:43:42.208896+00
171	novo_zaduzenje	zaduzenja	INSERT	127	2026-04-13 13:43:42.208896+00
172	novo_zaduzenje	zaduzenja	INSERT	128	2026-04-13 13:43:42.208896+00
173	novo_zaduzenje	zaduzenja	INSERT	129	2026-04-13 13:43:42.208896+00
174	novo_zaduzenje	zaduzenja	INSERT	130	2026-04-13 13:43:42.208896+00
175	novo_zaduzenje	zaduzenja	INSERT	131	2026-04-13 13:43:42.208896+00
176	novo_zaduzenje	zaduzenja	INSERT	132	2026-04-13 13:43:42.208896+00
177	novo_zaduzenje	zaduzenja	INSERT	133	2026-04-13 13:43:42.208896+00
178	novo_zaduzenje	zaduzenja	INSERT	134	2026-04-13 13:43:42.208896+00
179	novo_zaduzenje	zaduzenja	INSERT	135	2026-04-13 13:43:42.208896+00
180	novo_zaduzenje	zaduzenja	INSERT	136	2026-04-13 13:43:42.208896+00
181	novo_zaduzenje	zaduzenja	INSERT	137	2026-04-13 13:43:42.208896+00
182	novo_zaduzenje	zaduzenja	INSERT	138	2026-04-13 13:43:42.208896+00
183	novo_zaduzenje	zaduzenja	INSERT	139	2026-04-13 13:43:42.208896+00
184	novo_zaduzenje	zaduzenja	INSERT	140	2026-04-13 13:43:42.208896+00
185	novo_zaduzenje	zaduzenja	INSERT	141	2026-04-13 13:43:42.208896+00
186	novo_zaduzenje	zaduzenja	INSERT	142	2026-04-13 13:43:42.208896+00
187	novo_zaduzenje	zaduzenja	INSERT	143	2026-04-13 13:43:42.208896+00
188	novo_zaduzenje	zaduzenja	INSERT	144	2026-04-13 13:43:42.208896+00
189	novo_zaduzenje	zaduzenja	INSERT	145	2026-04-13 13:43:42.208896+00
190	novo_zaduzenje	zaduzenja	INSERT	146	2026-04-13 13:43:42.208896+00
191	novo_zaduzenje	zaduzenja	INSERT	147	2026-04-13 13:43:42.208896+00
192	novo_zaduzenje	zaduzenja	INSERT	148	2026-04-13 13:43:42.208896+00
193	novo_zaduzenje	zaduzenja	INSERT	149	2026-04-13 13:43:42.208896+00
194	novo_zaduzenje	zaduzenja	INSERT	150	2026-04-13 13:43:42.208896+00
195	novo_zaduzenje	zaduzenja	INSERT	151	2026-04-13 13:43:42.208896+00
196	novo_zaduzenje	zaduzenja	INSERT	152	2026-04-13 13:43:42.208896+00
197	novo_zaduzenje	zaduzenja	INSERT	153	2026-04-13 13:43:42.208896+00
198	novo_zaduzenje	zaduzenja	INSERT	154	2026-04-13 13:43:42.208896+00
199	novo_zaduzenje	zaduzenja	INSERT	155	2026-04-13 13:43:42.208896+00
200	novo_zaduzenje	zaduzenja	INSERT	156	2026-04-13 13:43:42.208896+00
201	novo_zaduzenje	zaduzenja	INSERT	157	2026-04-13 13:43:42.208896+00
202	novo_zaduzenje	zaduzenja	INSERT	158	2026-04-13 13:43:42.208896+00
203	novo_zaduzenje	zaduzenja	INSERT	159	2026-04-13 13:43:42.208896+00
204	novo_zaduzenje	zaduzenja	INSERT	160	2026-04-13 13:43:42.208896+00
205	novo_zaduzenje	zaduzenja	INSERT	161	2026-04-13 13:43:42.208896+00
206	novo_zaduzenje	zaduzenja	INSERT	162	2026-04-13 13:43:42.208896+00
207	novo_zaduzenje	zaduzenja	INSERT	163	2026-04-13 13:43:42.208896+00
208	novo_zaduzenje	zaduzenja	INSERT	164	2026-04-13 13:43:42.208896+00
209	novo_zaduzenje	zaduzenja	INSERT	165	2026-04-13 13:43:42.208896+00
210	novo_zaduzenje	zaduzenja	INSERT	166	2026-04-13 13:43:42.208896+00
211	novo_zaduzenje	zaduzenja	INSERT	167	2026-04-13 13:43:42.208896+00
212	novo_zaduzenje	zaduzenja	INSERT	168	2026-04-13 13:43:42.208896+00
213	novo_zaduzenje	zaduzenja	INSERT	169	2026-04-13 13:43:42.208896+00
214	novo_zaduzenje	zaduzenja	INSERT	170	2026-04-13 13:43:42.208896+00
215	novo_zaduzenje	zaduzenja	INSERT	171	2026-04-13 13:43:42.208896+00
216	novo_zaduzenje	zaduzenja	INSERT	172	2026-04-13 13:43:42.208896+00
217	novo_zaduzenje	zaduzenja	INSERT	173	2026-04-13 13:43:42.208896+00
218	novo_zaduzenje	zaduzenja	INSERT	174	2026-04-13 13:43:42.208896+00
219	novo_zaduzenje	zaduzenja	INSERT	175	2026-04-13 13:43:42.208896+00
220	novo_zaduzenje	zaduzenja	INSERT	176	2026-04-13 13:43:42.208896+00
221	novo_zaduzenje	zaduzenja	INSERT	177	2026-04-13 13:43:42.208896+00
222	novo_zaduzenje	zaduzenja	INSERT	178	2026-04-13 13:43:42.208896+00
223	novo_zaduzenje	zaduzenja	INSERT	179	2026-04-13 13:43:42.208896+00
224	novo_zaduzenje	zaduzenja	INSERT	180	2026-04-13 13:43:42.208896+00
225	novo_zaduzenje	zaduzenja	INSERT	181	2026-04-13 13:43:42.208896+00
226	novo_zaduzenje	zaduzenja	INSERT	182	2026-04-13 13:43:42.208896+00
227	novo_zaduzenje	zaduzenja	INSERT	183	2026-04-13 13:43:42.208896+00
228	novo_zaduzenje	zaduzenja	INSERT	184	2026-04-13 13:43:42.208896+00
229	novo_zaduzenje	zaduzenja	INSERT	185	2026-04-13 13:43:42.208896+00
230	novo_zaduzenje	zaduzenja	INSERT	186	2026-04-13 13:43:42.208896+00
231	novo_zaduzenje	zaduzenja	INSERT	187	2026-04-13 13:43:42.208896+00
232	novo_zaduzenje	zaduzenja	INSERT	188	2026-04-13 13:43:42.208896+00
233	novo_zaduzenje	zaduzenja	INSERT	189	2026-04-13 13:43:42.208896+00
234	novo_zaduzenje	zaduzenja	INSERT	190	2026-04-13 13:43:42.208896+00
235	novo_zaduzenje	zaduzenja	INSERT	191	2026-04-13 13:43:42.208896+00
236	novo_zaduzenje	zaduzenja	INSERT	192	2026-04-13 13:43:42.208896+00
237	novo_zaduzenje	zaduzenja	INSERT	193	2026-04-13 13:43:42.208896+00
238	novo_zaduzenje	zaduzenja	INSERT	194	2026-04-13 13:43:42.208896+00
239	novo_zaduzenje	zaduzenja	INSERT	195	2026-04-13 13:43:42.208896+00
240	novo_zaduzenje	zaduzenja	INSERT	196	2026-04-13 13:43:42.208896+00
241	novo_zaduzenje	zaduzenja	INSERT	197	2026-04-13 13:43:42.208896+00
242	novo_zaduzenje	zaduzenja	INSERT	198	2026-04-13 13:43:42.208896+00
243	novo_zaduzenje	zaduzenja	INSERT	199	2026-04-13 13:43:42.208896+00
244	novo_zaduzenje	zaduzenja	INSERT	200	2026-04-13 13:43:42.208896+00
245	novo_zaduzenje	zaduzenja	INSERT	201	2026-04-13 13:43:42.208896+00
246	novo_zaduzenje	zaduzenja	INSERT	202	2026-04-13 13:43:42.208896+00
247	novo_zaduzenje	zaduzenja	INSERT	203	2026-04-13 13:43:42.208896+00
248	novo_zaduzenje	zaduzenja	INSERT	204	2026-04-13 13:43:42.208896+00
249	novo_zaduzenje	zaduzenja	INSERT	205	2026-04-13 13:43:42.208896+00
250	novo_zaduzenje	zaduzenja	INSERT	206	2026-04-13 13:43:42.208896+00
251	novo_zaduzenje	zaduzenja	INSERT	207	2026-04-13 13:43:42.208896+00
252	novo_zaduzenje	zaduzenja	INSERT	208	2026-04-13 13:43:42.208896+00
253	novo_zaduzenje	zaduzenja	INSERT	209	2026-04-13 13:43:42.208896+00
254	novo_zaduzenje	zaduzenja	INSERT	210	2026-04-13 13:43:42.208896+00
255	novo_zaduzenje	zaduzenja	INSERT	211	2026-04-13 13:43:42.208896+00
256	novo_zaduzenje	zaduzenja	INSERT	212	2026-04-13 13:43:42.208896+00
257	novo_zaduzenje	zaduzenja	INSERT	213	2026-04-13 13:43:42.208896+00
258	novo_zaduzenje	zaduzenja	INSERT	214	2026-04-13 13:43:42.208896+00
259	novo_zaduzenje	zaduzenja	INSERT	215	2026-04-13 13:43:42.208896+00
260	novo_zaduzenje	zaduzenja	INSERT	216	2026-04-13 13:43:42.208896+00
261	novo_zaduzenje	zaduzenja	INSERT	217	2026-04-13 13:43:42.208896+00
262	novo_zaduzenje	zaduzenja	INSERT	218	2026-04-13 13:43:42.208896+00
263	novo_zaduzenje	zaduzenja	INSERT	219	2026-04-13 13:43:42.208896+00
264	novo_zaduzenje	zaduzenja	INSERT	220	2026-04-13 13:43:42.208896+00
265	novo_zaduzenje	zaduzenja	INSERT	221	2026-04-13 13:43:42.208896+00
266	novo_zaduzenje	zaduzenja	INSERT	222	2026-04-13 13:43:42.208896+00
267	novo_zaduzenje	zaduzenja	INSERT	223	2026-04-13 13:43:42.208896+00
268	novo_zaduzenje	zaduzenja	INSERT	224	2026-04-13 13:43:42.208896+00
269	novo_zaduzenje	zaduzenja	INSERT	225	2026-04-13 13:43:42.208896+00
270	novo_zaduzenje	zaduzenja	INSERT	226	2026-04-13 13:43:42.208896+00
271	novo_zaduzenje	zaduzenja	INSERT	227	2026-04-13 13:43:42.208896+00
272	novo_zaduzenje	zaduzenja	INSERT	228	2026-04-13 13:43:42.208896+00
273	novo_zaduzenje	zaduzenja	INSERT	229	2026-04-13 13:43:42.208896+00
274	novo_zaduzenje	zaduzenja	INSERT	230	2026-04-13 13:43:42.208896+00
275	novo_zaduzenje	zaduzenja	INSERT	231	2026-04-13 13:43:42.208896+00
276	novo_zaduzenje	zaduzenja	INSERT	232	2026-04-13 13:43:42.208896+00
277	novo_zaduzenje	zaduzenja	INSERT	233	2026-04-13 13:43:42.208896+00
278	novo_zaduzenje	zaduzenja	INSERT	234	2026-04-13 13:43:42.208896+00
279	novo_zaduzenje	zaduzenja	INSERT	235	2026-04-13 13:43:42.208896+00
280	novo_zaduzenje	zaduzenja	INSERT	236	2026-04-13 13:43:42.208896+00
281	novo_zaduzenje	zaduzenja	INSERT	237	2026-04-13 13:43:42.208896+00
282	novo_zaduzenje	zaduzenja	INSERT	238	2026-04-13 13:43:42.208896+00
283	novo_zaduzenje	zaduzenja	INSERT	239	2026-04-13 13:43:42.208896+00
284	novo_zaduzenje	zaduzenja	INSERT	240	2026-04-13 13:43:42.208896+00
285	novo_zaduzenje	zaduzenja	INSERT	241	2026-04-13 13:43:42.208896+00
286	novo_zaduzenje	zaduzenja	INSERT	242	2026-04-13 13:43:42.208896+00
287	novo_zaduzenje	zaduzenja	INSERT	243	2026-04-13 13:43:42.208896+00
288	novo_zaduzenje	zaduzenja	INSERT	244	2026-04-13 13:43:42.208896+00
289	novo_zaduzenje	zaduzenja	INSERT	245	2026-04-13 13:43:42.208896+00
290	novo_zaduzenje	zaduzenja	INSERT	246	2026-04-13 13:43:42.208896+00
291	novo_zaduzenje	zaduzenja	INSERT	247	2026-04-13 13:43:42.208896+00
292	novo_zaduzenje	zaduzenja	INSERT	248	2026-04-13 13:43:42.208896+00
293	novo_zaduzenje	zaduzenja	INSERT	249	2026-04-13 13:43:42.208896+00
294	novo_zaduzenje	zaduzenja	INSERT	250	2026-04-13 13:43:42.208896+00
295	novo_zaduzenje	zaduzenja	INSERT	251	2026-04-13 13:43:42.208896+00
296	novo_zaduzenje	zaduzenja	INSERT	252	2026-04-13 13:43:42.208896+00
297	novo_zaduzenje	zaduzenja	INSERT	253	2026-04-13 13:43:42.208896+00
298	novo_zaduzenje	zaduzenja	INSERT	254	2026-04-13 13:43:42.208896+00
299	novo_zaduzenje	zaduzenja	INSERT	255	2026-04-13 13:43:42.208896+00
300	novo_zaduzenje	zaduzenja	INSERT	256	2026-04-13 13:43:42.208896+00
301	novo_zaduzenje	zaduzenja	INSERT	257	2026-04-13 13:43:42.208896+00
302	novo_zaduzenje	zaduzenja	INSERT	258	2026-04-13 13:43:42.208896+00
303	novo_zaduzenje	zaduzenja	INSERT	259	2026-04-13 13:43:42.208896+00
304	novo_zaduzenje	zaduzenja	INSERT	260	2026-04-13 13:43:42.208896+00
305	novo_zaduzenje	zaduzenja	INSERT	261	2026-04-13 13:43:42.208896+00
306	novo_zaduzenje	zaduzenja	INSERT	262	2026-04-13 13:43:42.208896+00
307	novo_zaduzenje	zaduzenja	INSERT	263	2026-04-13 13:43:42.208896+00
308	novo_zaduzenje	zaduzenja	INSERT	264	2026-04-13 13:43:42.208896+00
309	novo_zaduzenje	zaduzenja	INSERT	265	2026-04-13 13:43:42.208896+00
310	novo_zaduzenje	zaduzenja	INSERT	266	2026-04-13 13:43:42.208896+00
311	novo_zaduzenje	zaduzenja	INSERT	267	2026-04-13 13:43:42.208896+00
312	novo_zaduzenje	zaduzenja	INSERT	268	2026-04-13 13:43:42.208896+00
313	novo_zaduzenje	zaduzenja	INSERT	269	2026-04-13 13:43:42.208896+00
314	novo_zaduzenje	zaduzenja	INSERT	270	2026-04-13 13:43:42.208896+00
315	novo_zaduzenje	zaduzenja	INSERT	271	2026-04-13 13:43:42.208896+00
316	novo_zaduzenje	zaduzenja	INSERT	272	2026-04-13 13:43:42.208896+00
317	novo_zaduzenje	zaduzenja	INSERT	273	2026-04-13 13:43:42.208896+00
318	novo_zaduzenje	zaduzenja	INSERT	274	2026-04-13 13:43:42.208896+00
319	novo_zaduzenje	zaduzenja	INSERT	275	2026-04-13 13:43:42.208896+00
320	novo_zaduzenje	zaduzenja	INSERT	276	2026-04-13 13:43:42.208896+00
321	novo_zaduzenje	zaduzenja	INSERT	277	2026-04-13 13:43:42.208896+00
322	novo_zaduzenje	zaduzenja	INSERT	278	2026-04-13 13:43:42.208896+00
323	novo_zaduzenje	zaduzenja	INSERT	279	2026-04-13 13:43:42.208896+00
324	novo_zaduzenje	zaduzenja	INSERT	280	2026-04-13 13:43:42.208896+00
325	novo_zaduzenje	zaduzenja	INSERT	281	2026-04-13 13:43:42.208896+00
326	novo_zaduzenje	zaduzenja	INSERT	282	2026-04-13 13:43:42.208896+00
327	novo_zaduzenje	zaduzenja	INSERT	283	2026-04-13 13:43:42.208896+00
328	novo_zaduzenje	zaduzenja	INSERT	284	2026-04-13 13:43:42.208896+00
329	novo_zaduzenje	zaduzenja	INSERT	285	2026-04-13 13:43:42.208896+00
330	novo_zaduzenje	zaduzenja	INSERT	286	2026-04-13 13:43:42.208896+00
331	novo_zaduzenje	zaduzenja	INSERT	287	2026-04-13 13:43:42.208896+00
332	novo_zaduzenje	zaduzenja	INSERT	288	2026-04-13 13:43:42.208896+00
333	novo_zaduzenje	zaduzenja	INSERT	289	2026-04-13 13:43:42.208896+00
334	novo_zaduzenje	zaduzenja	INSERT	290	2026-04-13 13:43:42.208896+00
335	novo_zaduzenje	zaduzenja	INSERT	291	2026-04-13 13:43:42.208896+00
336	novo_zaduzenje	zaduzenja	INSERT	292	2026-04-13 13:43:42.208896+00
337	novo_zaduzenje	zaduzenja	INSERT	293	2026-04-13 13:43:42.208896+00
338	novo_zaduzenje	zaduzenja	INSERT	294	2026-04-13 13:43:42.208896+00
339	novo_zaduzenje	zaduzenja	INSERT	295	2026-04-13 13:43:42.208896+00
340	novo_zaduzenje	zaduzenja	INSERT	296	2026-04-13 13:43:42.208896+00
341	novo_zaduzenje	zaduzenja	INSERT	297	2026-04-13 13:43:42.208896+00
342	novo_zaduzenje	zaduzenja	INSERT	298	2026-04-13 13:43:42.208896+00
343	novo_zaduzenje	zaduzenja	INSERT	299	2026-04-13 13:43:42.208896+00
344	novo_zaduzenje	zaduzenja	INSERT	300	2026-04-13 13:43:42.208896+00
345	novo_zaduzenje	zaduzenja	INSERT	301	2026-04-13 13:43:42.208896+00
346	novo_zaduzenje	zaduzenja	INSERT	302	2026-04-13 13:43:42.208896+00
347	novo_zaduzenje	zaduzenja	INSERT	303	2026-04-13 13:43:42.208896+00
348	novo_zaduzenje	zaduzenja	INSERT	304	2026-04-13 13:43:42.208896+00
349	novo_zaduzenje	zaduzenja	INSERT	305	2026-04-13 13:43:42.208896+00
350	novo_zaduzenje	zaduzenja	INSERT	306	2026-04-13 13:43:42.208896+00
351	novo_zaduzenje	zaduzenja	INSERT	307	2026-04-13 13:43:42.208896+00
352	novo_zaduzenje	zaduzenja	INSERT	308	2026-04-13 13:43:42.208896+00
353	novo_zaduzenje	zaduzenja	INSERT	309	2026-04-13 13:43:42.208896+00
354	novo_zaduzenje	zaduzenja	INSERT	310	2026-04-13 13:43:42.208896+00
355	novo_zaduzenje	zaduzenja	INSERT	311	2026-04-13 13:43:42.208896+00
356	novo_zaduzenje	zaduzenja	INSERT	312	2026-04-13 13:43:42.208896+00
357	novo_zaduzenje	zaduzenja	INSERT	313	2026-04-13 13:43:42.208896+00
358	novo_zaduzenje	zaduzenja	INSERT	314	2026-04-13 13:43:42.208896+00
359	novo_zaduzenje	zaduzenja	INSERT	315	2026-04-13 13:43:42.208896+00
360	novo_zaduzenje	zaduzenja	INSERT	316	2026-04-13 13:43:42.208896+00
361	novo_zaduzenje	zaduzenja	INSERT	317	2026-04-13 13:43:42.208896+00
362	novo_zaduzenje	zaduzenja	INSERT	318	2026-04-13 13:43:42.208896+00
363	novo_zaduzenje	zaduzenja	INSERT	319	2026-04-13 13:43:42.208896+00
364	novo_zaduzenje	zaduzenja	INSERT	320	2026-04-13 13:43:42.208896+00
365	novo_zaduzenje	zaduzenja	INSERT	321	2026-04-13 13:43:42.208896+00
366	novo_zaduzenje	zaduzenja	INSERT	322	2026-04-13 13:43:42.208896+00
367	novo_zaduzenje	zaduzenja	INSERT	323	2026-04-13 13:43:42.208896+00
368	novo_zaduzenje	zaduzenja	INSERT	324	2026-04-13 13:43:42.208896+00
369	novo_zaduzenje	zaduzenja	INSERT	325	2026-04-13 13:43:42.208896+00
370	novo_zaduzenje	zaduzenja	INSERT	326	2026-04-13 13:43:42.208896+00
371	novo_zaduzenje	zaduzenja	INSERT	327	2026-04-13 13:43:42.208896+00
372	novo_zaduzenje	zaduzenja	INSERT	328	2026-04-13 13:43:42.208896+00
373	novo_zaduzenje	zaduzenja	INSERT	329	2026-04-13 13:43:42.208896+00
374	novo_zaduzenje	zaduzenja	INSERT	330	2026-04-13 13:43:42.208896+00
375	novo_zaduzenje	zaduzenja	INSERT	331	2026-04-13 13:43:42.208896+00
376	novo_zaduzenje	zaduzenja	INSERT	332	2026-04-13 13:43:42.208896+00
377	novo_zaduzenje	zaduzenja	INSERT	333	2026-04-13 13:43:42.208896+00
378	novo_zaduzenje	zaduzenja	INSERT	334	2026-04-13 13:43:42.208896+00
379	novo_zaduzenje	zaduzenja	INSERT	335	2026-04-13 13:43:42.208896+00
380	novo_zaduzenje	zaduzenja	INSERT	336	2026-04-13 13:43:42.208896+00
381	novo_zaduzenje	zaduzenja	INSERT	337	2026-04-13 13:43:42.208896+00
382	novo_zaduzenje	zaduzenja	INSERT	338	2026-04-13 13:43:42.208896+00
383	novo_zaduzenje	zaduzenja	INSERT	339	2026-04-13 13:43:42.208896+00
384	novo_zaduzenje	zaduzenja	INSERT	340	2026-04-13 13:43:42.208896+00
385	novo_zaduzenje	zaduzenja	INSERT	341	2026-04-13 13:43:42.208896+00
386	novo_zaduzenje	zaduzenja	INSERT	342	2026-04-13 13:43:42.208896+00
387	novo_zaduzenje	zaduzenja	INSERT	343	2026-04-13 13:43:42.208896+00
388	novo_zaduzenje	zaduzenja	INSERT	344	2026-04-13 13:43:42.208896+00
389	novo_zaduzenje	zaduzenja	INSERT	345	2026-04-13 13:43:42.208896+00
390	novo_zaduzenje	zaduzenja	INSERT	346	2026-04-13 13:43:42.208896+00
391	novo_zaduzenje	zaduzenja	INSERT	347	2026-04-13 13:43:42.208896+00
392	novo_zaduzenje	zaduzenja	INSERT	348	2026-04-13 13:43:42.208896+00
393	novo_zaduzenje	zaduzenja	INSERT	349	2026-04-13 13:43:42.208896+00
394	novo_zaduzenje	zaduzenja	INSERT	350	2026-04-13 13:43:42.208896+00
395	novo_zaduzenje	zaduzenja	INSERT	351	2026-04-13 13:43:42.208896+00
396	novo_zaduzenje	zaduzenja	INSERT	352	2026-04-13 13:43:42.208896+00
397	novo_zaduzenje	zaduzenja	INSERT	353	2026-04-13 13:43:42.208896+00
398	novo_zaduzenje	zaduzenja	INSERT	354	2026-04-13 13:43:42.208896+00
399	novo_zaduzenje	zaduzenja	INSERT	355	2026-04-13 13:43:42.208896+00
400	novo_zaduzenje	zaduzenja	INSERT	356	2026-04-13 13:43:42.208896+00
401	novo_zaduzenje	zaduzenja	INSERT	357	2026-04-13 13:43:42.208896+00
402	novo_zaduzenje	zaduzenja	INSERT	358	2026-04-13 13:43:42.208896+00
403	novo_zaduzenje	zaduzenja	INSERT	359	2026-04-13 13:43:42.208896+00
404	novo_zaduzenje	zaduzenja	INSERT	360	2026-04-13 13:43:42.208896+00
405	novo_zaduzenje	zaduzenja	INSERT	361	2026-04-13 13:43:42.208896+00
406	novo_zaduzenje	zaduzenja	INSERT	362	2026-04-13 13:43:42.208896+00
407	novo_zaduzenje	zaduzenja	INSERT	363	2026-04-13 13:43:42.208896+00
408	novo_zaduzenje	zaduzenja	INSERT	364	2026-04-13 13:43:42.208896+00
409	novo_zaduzenje	zaduzenja	INSERT	365	2026-04-13 13:43:42.208896+00
410	novo_zaduzenje	zaduzenja	INSERT	366	2026-04-13 13:43:42.208896+00
411	novo_zaduzenje	zaduzenja	INSERT	367	2026-04-13 13:43:42.208896+00
412	novo_zaduzenje	zaduzenja	INSERT	368	2026-04-13 13:43:42.208896+00
413	novo_zaduzenje	zaduzenja	INSERT	369	2026-04-13 13:43:42.208896+00
414	novo_zaduzenje	zaduzenja	INSERT	370	2026-04-13 13:43:42.208896+00
415	novo_zaduzenje	zaduzenja	INSERT	371	2026-04-13 13:43:42.208896+00
416	novo_zaduzenje	zaduzenja	INSERT	372	2026-04-13 13:43:42.208896+00
417	novo_zaduzenje	zaduzenja	INSERT	373	2026-04-13 13:43:42.208896+00
418	novo_zaduzenje	zaduzenja	INSERT	374	2026-04-13 13:43:42.208896+00
419	novo_zaduzenje	zaduzenja	INSERT	375	2026-04-13 13:43:42.208896+00
420	novo_zaduzenje	zaduzenja	INSERT	376	2026-04-13 13:43:42.208896+00
421	novo_zaduzenje	zaduzenja	INSERT	377	2026-04-13 13:43:42.208896+00
422	novo_zaduzenje	zaduzenja	INSERT	378	2026-04-13 13:43:42.208896+00
423	novo_zaduzenje	zaduzenja	INSERT	379	2026-04-13 13:43:42.208896+00
424	novo_zaduzenje	zaduzenja	INSERT	380	2026-04-13 13:43:42.208896+00
425	novo_zaduzenje	zaduzenja	INSERT	381	2026-04-13 13:43:42.208896+00
426	novo_zaduzenje	zaduzenja	INSERT	382	2026-04-13 13:43:42.208896+00
427	novo_zaduzenje	zaduzenja	INSERT	383	2026-04-13 13:43:42.208896+00
428	novo_zaduzenje	zaduzenja	INSERT	384	2026-04-13 13:43:42.208896+00
429	novo_zaduzenje	zaduzenja	INSERT	385	2026-04-13 13:43:42.208896+00
430	novo_zaduzenje	zaduzenja	INSERT	386	2026-04-13 13:43:42.208896+00
431	novo_zaduzenje	zaduzenja	INSERT	387	2026-04-13 13:43:42.208896+00
432	novo_zaduzenje	zaduzenja	INSERT	388	2026-04-13 13:43:42.208896+00
433	novo_zaduzenje	zaduzenja	INSERT	389	2026-04-13 13:43:42.208896+00
434	novo_zaduzenje	zaduzenja	INSERT	390	2026-04-13 13:43:42.208896+00
435	novo_zaduzenje	zaduzenja	INSERT	391	2026-04-13 13:43:42.208896+00
436	novo_zaduzenje	zaduzenja	INSERT	392	2026-04-13 13:43:42.208896+00
437	novo_zaduzenje	zaduzenja	INSERT	393	2026-04-13 13:43:42.208896+00
438	novo_zaduzenje	zaduzenja	INSERT	394	2026-04-13 13:43:42.208896+00
439	novo_zaduzenje	zaduzenja	INSERT	395	2026-04-13 13:43:42.208896+00
440	novo_zaduzenje	zaduzenja	INSERT	396	2026-04-13 13:43:42.208896+00
441	novo_zaduzenje	zaduzenja	INSERT	397	2026-04-13 13:43:42.208896+00
442	novo_zaduzenje	zaduzenja	INSERT	398	2026-04-13 13:43:42.208896+00
443	novo_zaduzenje	zaduzenja	INSERT	399	2026-04-13 13:43:42.208896+00
444	novo_zaduzenje	zaduzenja	INSERT	400	2026-04-13 13:43:42.208896+00
445	novo_zaduzenje	zaduzenja	INSERT	401	2026-04-13 13:43:42.208896+00
446	novo_zaduzenje	zaduzenja	INSERT	402	2026-04-13 13:43:42.208896+00
447	novo_zaduzenje	zaduzenja	INSERT	403	2026-04-13 13:43:42.208896+00
448	novo_zaduzenje	zaduzenja	INSERT	404	2026-04-13 13:43:42.208896+00
449	novo_zaduzenje	zaduzenja	INSERT	405	2026-04-13 13:43:42.208896+00
450	novo_zaduzenje	zaduzenja	INSERT	406	2026-04-13 13:43:42.208896+00
451	novo_zaduzenje	zaduzenja	INSERT	407	2026-04-13 13:43:42.208896+00
452	novo_zaduzenje	zaduzenja	INSERT	408	2026-04-13 13:43:42.208896+00
453	novo_zaduzenje	zaduzenja	INSERT	409	2026-04-13 13:43:42.208896+00
454	novo_zaduzenje	zaduzenja	INSERT	410	2026-04-13 13:43:42.208896+00
455	novo_zaduzenje	zaduzenja	INSERT	411	2026-04-13 13:43:42.208896+00
456	novo_zaduzenje	zaduzenja	INSERT	412	2026-04-13 13:43:42.208896+00
457	novo_zaduzenje	zaduzenja	INSERT	413	2026-04-13 13:43:42.208896+00
458	novo_zaduzenje	zaduzenja	INSERT	414	2026-04-13 13:43:42.208896+00
459	novo_zaduzenje	zaduzenja	INSERT	415	2026-04-13 13:43:42.208896+00
460	novo_zaduzenje	zaduzenja	INSERT	416	2026-04-13 13:43:42.208896+00
461	novo_zaduzenje	zaduzenja	INSERT	417	2026-04-13 13:43:42.208896+00
462	novo_zaduzenje	zaduzenja	INSERT	418	2026-04-13 13:43:42.208896+00
463	novo_zaduzenje	zaduzenja	INSERT	419	2026-04-13 13:43:42.208896+00
464	novo_zaduzenje	zaduzenja	INSERT	420	2026-04-13 13:43:42.208896+00
465	novo_zaduzenje	zaduzenja	INSERT	421	2026-04-13 13:43:42.208896+00
466	novo_zaduzenje	zaduzenja	INSERT	422	2026-04-13 13:43:42.208896+00
467	novo_zaduzenje	zaduzenja	INSERT	423	2026-04-13 13:43:42.208896+00
468	novo_zaduzenje	zaduzenja	INSERT	424	2026-04-13 13:43:42.208896+00
469	novo_zaduzenje	zaduzenja	INSERT	425	2026-04-13 13:43:42.208896+00
470	novo_zaduzenje	zaduzenja	INSERT	426	2026-04-13 13:43:42.208896+00
471	novo_zaduzenje	zaduzenja	INSERT	427	2026-04-13 13:43:42.208896+00
472	novo_zaduzenje	zaduzenja	INSERT	428	2026-04-13 13:43:42.208896+00
473	novo_zaduzenje	zaduzenja	INSERT	429	2026-04-13 13:43:42.208896+00
474	novo_zaduzenje	zaduzenja	INSERT	430	2026-04-13 13:43:42.208896+00
475	novo_zaduzenje	zaduzenja	INSERT	431	2026-04-13 13:43:42.208896+00
476	novo_zaduzenje	zaduzenja	INSERT	432	2026-04-13 13:43:42.208896+00
477	novo_zaduzenje	zaduzenja	INSERT	433	2026-04-13 13:43:42.208896+00
478	novo_zaduzenje	zaduzenja	INSERT	434	2026-04-13 13:43:42.208896+00
479	novo_zaduzenje	zaduzenja	INSERT	435	2026-04-13 13:43:42.208896+00
480	novo_zaduzenje	zaduzenja	INSERT	436	2026-04-13 13:43:42.208896+00
481	novo_zaduzenje	zaduzenja	INSERT	437	2026-04-13 13:43:42.208896+00
482	novo_zaduzenje	zaduzenja	INSERT	438	2026-04-13 13:43:42.208896+00
483	novo_zaduzenje	zaduzenja	INSERT	439	2026-04-13 13:43:42.208896+00
484	novo_zaduzenje	zaduzenja	INSERT	440	2026-04-13 13:43:42.208896+00
485	novo_zaduzenje	zaduzenja	INSERT	441	2026-04-13 13:43:42.208896+00
486	novo_zaduzenje	zaduzenja	INSERT	442	2026-04-13 13:43:42.208896+00
487	novo_zaduzenje	zaduzenja	INSERT	443	2026-04-13 13:43:42.208896+00
488	novo_zaduzenje	zaduzenja	INSERT	444	2026-04-13 13:43:42.208896+00
489	novo_zaduzenje	zaduzenja	INSERT	445	2026-04-13 13:43:42.208896+00
490	novo_zaduzenje	zaduzenja	INSERT	446	2026-04-13 13:43:42.208896+00
491	novo_zaduzenje	zaduzenja	INSERT	447	2026-04-13 13:43:42.208896+00
492	novo_zaduzenje	zaduzenja	INSERT	448	2026-04-13 13:43:42.208896+00
493	novo_zaduzenje	zaduzenja	INSERT	449	2026-04-13 13:43:42.208896+00
494	novo_zaduzenje	zaduzenja	INSERT	450	2026-04-13 13:43:42.208896+00
495	novo_zaduzenje	zaduzenja	INSERT	451	2026-04-13 13:43:42.208896+00
496	novo_zaduzenje	zaduzenja	INSERT	452	2026-04-13 13:43:42.208896+00
497	novo_zaduzenje	zaduzenja	INSERT	453	2026-04-13 13:43:42.208896+00
498	novo_zaduzenje	zaduzenja	INSERT	454	2026-04-13 13:43:42.208896+00
499	novo_zaduzenje	zaduzenja	INSERT	455	2026-04-13 13:43:42.208896+00
500	novo_zaduzenje	zaduzenja	INSERT	456	2026-04-13 13:43:42.208896+00
501	novo_zaduzenje	zaduzenja	INSERT	457	2026-04-13 13:43:42.208896+00
502	novo_zaduzenje	zaduzenja	INSERT	458	2026-04-13 13:43:42.208896+00
503	novo_zaduzenje	zaduzenja	INSERT	459	2026-04-13 13:43:42.208896+00
504	novo_zaduzenje	zaduzenja	INSERT	460	2026-04-13 13:43:42.208896+00
505	novo_zaduzenje	zaduzenja	INSERT	461	2026-04-13 13:43:42.208896+00
506	novo_zaduzenje	zaduzenja	INSERT	462	2026-04-13 13:43:42.208896+00
507	novo_zaduzenje	zaduzenja	INSERT	463	2026-04-13 13:43:42.208896+00
508	novo_zaduzenje	zaduzenja	INSERT	464	2026-04-13 13:43:42.208896+00
509	novo_zaduzenje	zaduzenja	INSERT	465	2026-04-13 13:43:42.208896+00
510	novo_zaduzenje	zaduzenja	INSERT	466	2026-04-13 13:43:42.208896+00
511	novo_zaduzenje	zaduzenja	INSERT	467	2026-04-13 13:43:42.208896+00
512	novo_zaduzenje	zaduzenja	INSERT	468	2026-04-13 13:43:42.208896+00
513	novo_zaduzenje	zaduzenja	INSERT	469	2026-04-13 13:43:42.208896+00
514	novo_zaduzenje	zaduzenja	INSERT	470	2026-04-13 13:43:42.208896+00
515	novo_zaduzenje	zaduzenja	INSERT	471	2026-04-13 13:43:42.208896+00
516	novo_zaduzenje	zaduzenja	INSERT	472	2026-04-13 13:43:42.208896+00
517	novo_zaduzenje	zaduzenja	INSERT	473	2026-04-13 13:43:42.208896+00
518	novo_zaduzenje	zaduzenja	INSERT	474	2026-04-13 13:43:42.208896+00
519	novo_zaduzenje	zaduzenja	INSERT	475	2026-04-13 13:43:42.208896+00
520	novo_zaduzenje	zaduzenja	INSERT	476	2026-04-13 13:43:42.208896+00
521	novo_zaduzenje	zaduzenja	INSERT	477	2026-04-13 13:43:42.208896+00
522	novo_zaduzenje	zaduzenja	INSERT	478	2026-04-13 13:43:42.208896+00
523	novo_zaduzenje	zaduzenja	INSERT	479	2026-04-13 13:43:42.208896+00
524	novo_zaduzenje	zaduzenja	INSERT	480	2026-04-13 13:43:42.208896+00
525	novo_zaduzenje	zaduzenja	INSERT	481	2026-04-13 13:43:42.208896+00
526	novo_zaduzenje	zaduzenja	INSERT	482	2026-04-13 13:43:42.208896+00
527	novo_zaduzenje	zaduzenja	INSERT	483	2026-04-13 13:43:42.208896+00
528	novo_zaduzenje	zaduzenja	INSERT	484	2026-04-13 13:43:42.208896+00
529	novo_zaduzenje	zaduzenja	INSERT	485	2026-04-13 13:43:42.208896+00
530	novo_zaduzenje	zaduzenja	INSERT	486	2026-04-13 13:43:42.208896+00
531	novo_zaduzenje	zaduzenja	INSERT	487	2026-04-13 13:43:42.208896+00
532	novo_zaduzenje	zaduzenja	INSERT	488	2026-04-13 13:43:42.208896+00
533	novo_zaduzenje	zaduzenja	INSERT	489	2026-04-13 13:43:42.208896+00
534	novo_zaduzenje	zaduzenja	INSERT	490	2026-04-13 13:43:42.208896+00
535	novo_zaduzenje	zaduzenja	INSERT	491	2026-04-13 13:43:42.208896+00
536	novo_zaduzenje	zaduzenja	INSERT	492	2026-04-13 13:43:42.208896+00
537	novo_zaduzenje	zaduzenja	INSERT	493	2026-04-13 13:43:42.208896+00
538	novo_zaduzenje	zaduzenja	INSERT	494	2026-04-13 13:43:42.208896+00
539	novo_zaduzenje	zaduzenja	INSERT	495	2026-04-13 13:43:42.208896+00
540	novo_zaduzenje	zaduzenja	INSERT	496	2026-04-13 13:43:42.208896+00
541	novo_zaduzenje	zaduzenja	INSERT	497	2026-04-13 13:43:42.208896+00
542	unos_goriva	evidencija_goriva	INSERT	49	2026-04-13 13:43:42.208896+00
543	unos_goriva	evidencija_goriva	INSERT	50	2026-04-13 13:43:42.208896+00
544	unos_goriva	evidencija_goriva	INSERT	51	2026-04-13 13:43:42.208896+00
545	unos_goriva	evidencija_goriva	INSERT	52	2026-04-13 13:43:42.208896+00
546	unos_goriva	evidencija_goriva	INSERT	53	2026-04-13 13:43:42.208896+00
547	unos_goriva	evidencija_goriva	INSERT	54	2026-04-13 13:43:42.208896+00
548	unos_goriva	evidencija_goriva	INSERT	55	2026-04-13 13:43:42.208896+00
549	unos_goriva	evidencija_goriva	INSERT	56	2026-04-13 13:43:42.208896+00
550	unos_goriva	evidencija_goriva	INSERT	57	2026-04-13 13:43:42.208896+00
551	unos_goriva	evidencija_goriva	INSERT	58	2026-04-13 13:43:42.208896+00
552	unos_goriva	evidencija_goriva	INSERT	59	2026-04-13 13:43:42.208896+00
553	unos_goriva	evidencija_goriva	INSERT	60	2026-04-13 13:43:42.208896+00
554	unos_goriva	evidencija_goriva	INSERT	61	2026-04-13 13:43:42.208896+00
555	unos_goriva	evidencija_goriva	INSERT	62	2026-04-13 13:43:42.208896+00
556	unos_goriva	evidencija_goriva	INSERT	63	2026-04-13 13:43:42.208896+00
557	unos_goriva	evidencija_goriva	INSERT	64	2026-04-13 13:43:42.208896+00
558	unos_goriva	evidencija_goriva	INSERT	65	2026-04-13 13:43:42.208896+00
559	unos_goriva	evidencija_goriva	INSERT	66	2026-04-13 13:43:42.208896+00
560	unos_goriva	evidencija_goriva	INSERT	67	2026-04-13 13:43:42.208896+00
561	unos_goriva	evidencija_goriva	INSERT	68	2026-04-13 13:43:42.208896+00
562	unos_goriva	evidencija_goriva	INSERT	69	2026-04-13 13:43:42.208896+00
563	unos_goriva	evidencija_goriva	INSERT	70	2026-04-13 13:43:42.208896+00
564	unos_goriva	evidencija_goriva	INSERT	71	2026-04-13 13:43:42.208896+00
565	unos_goriva	evidencija_goriva	INSERT	72	2026-04-13 13:43:42.208896+00
566	unos_goriva	evidencija_goriva	INSERT	73	2026-04-13 13:43:42.208896+00
567	unos_goriva	evidencija_goriva	INSERT	74	2026-04-13 13:43:42.208896+00
568	unos_goriva	evidencija_goriva	INSERT	75	2026-04-13 13:43:42.208896+00
569	unos_goriva	evidencija_goriva	INSERT	76	2026-04-13 13:43:42.208896+00
570	unos_goriva	evidencija_goriva	INSERT	77	2026-04-13 13:43:42.208896+00
571	unos_goriva	evidencija_goriva	INSERT	78	2026-04-13 13:43:42.208896+00
572	unos_goriva	evidencija_goriva	INSERT	79	2026-04-13 13:43:42.208896+00
573	unos_goriva	evidencija_goriva	INSERT	80	2026-04-13 13:43:42.208896+00
574	unos_goriva	evidencija_goriva	INSERT	81	2026-04-13 13:43:42.208896+00
575	unos_goriva	evidencija_goriva	INSERT	82	2026-04-13 13:43:42.208896+00
576	unos_goriva	evidencija_goriva	INSERT	83	2026-04-13 13:43:42.208896+00
577	unos_goriva	evidencija_goriva	INSERT	84	2026-04-13 13:43:42.208896+00
578	unos_goriva	evidencija_goriva	INSERT	85	2026-04-13 13:43:42.208896+00
579	unos_goriva	evidencija_goriva	INSERT	86	2026-04-13 13:43:42.208896+00
580	unos_goriva	evidencija_goriva	INSERT	87	2026-04-13 13:43:42.208896+00
581	unos_goriva	evidencija_goriva	INSERT	88	2026-04-13 13:43:42.208896+00
582	unos_goriva	evidencija_goriva	INSERT	89	2026-04-13 13:43:42.208896+00
583	unos_goriva	evidencija_goriva	INSERT	90	2026-04-13 13:43:42.208896+00
584	unos_goriva	evidencija_goriva	INSERT	91	2026-04-13 13:43:42.208896+00
585	unos_goriva	evidencija_goriva	INSERT	92	2026-04-13 13:43:42.208896+00
586	unos_goriva	evidencija_goriva	INSERT	93	2026-04-13 13:43:42.208896+00
587	unos_goriva	evidencija_goriva	INSERT	94	2026-04-13 13:43:42.208896+00
588	unos_goriva	evidencija_goriva	INSERT	95	2026-04-13 13:43:42.208896+00
589	unos_goriva	evidencija_goriva	INSERT	96	2026-04-13 13:43:42.208896+00
590	unos_goriva	evidencija_goriva	INSERT	97	2026-04-13 13:43:42.208896+00
591	unos_goriva	evidencija_goriva	INSERT	98	2026-04-13 13:43:42.208896+00
592	unos_goriva	evidencija_goriva	INSERT	99	2026-04-13 13:43:42.208896+00
593	unos_goriva	evidencija_goriva	INSERT	100	2026-04-13 13:43:42.208896+00
594	unos_goriva	evidencija_goriva	INSERT	101	2026-04-13 13:43:42.208896+00
595	unos_goriva	evidencija_goriva	INSERT	102	2026-04-13 13:43:42.208896+00
596	unos_goriva	evidencija_goriva	INSERT	103	2026-04-13 13:43:42.208896+00
597	unos_goriva	evidencija_goriva	INSERT	104	2026-04-13 13:43:42.208896+00
598	unos_goriva	evidencija_goriva	INSERT	105	2026-04-13 13:43:42.208896+00
599	unos_goriva	evidencija_goriva	INSERT	106	2026-04-13 13:43:42.208896+00
600	unos_goriva	evidencija_goriva	INSERT	107	2026-04-13 13:43:42.208896+00
601	unos_goriva	evidencija_goriva	INSERT	108	2026-04-13 13:43:42.208896+00
602	unos_goriva	evidencija_goriva	INSERT	109	2026-04-13 13:43:42.208896+00
603	unos_goriva	evidencija_goriva	INSERT	110	2026-04-13 13:43:42.208896+00
604	unos_goriva	evidencija_goriva	INSERT	111	2026-04-13 13:43:42.208896+00
605	unos_goriva	evidencija_goriva	INSERT	112	2026-04-13 13:43:42.208896+00
606	unos_goriva	evidencija_goriva	INSERT	113	2026-04-13 13:43:42.208896+00
607	unos_goriva	evidencija_goriva	INSERT	114	2026-04-13 13:43:42.208896+00
608	unos_goriva	evidencija_goriva	INSERT	115	2026-04-13 13:43:42.208896+00
609	unos_goriva	evidencija_goriva	INSERT	116	2026-04-13 13:43:42.208896+00
610	unos_goriva	evidencija_goriva	INSERT	117	2026-04-13 13:43:42.208896+00
611	unos_goriva	evidencija_goriva	INSERT	118	2026-04-13 13:43:42.208896+00
612	unos_goriva	evidencija_goriva	INSERT	119	2026-04-13 13:43:42.208896+00
613	unos_goriva	evidencija_goriva	INSERT	120	2026-04-13 13:43:42.208896+00
614	unos_goriva	evidencija_goriva	INSERT	121	2026-04-13 13:43:42.208896+00
615	unos_goriva	evidencija_goriva	INSERT	122	2026-04-13 13:43:42.208896+00
616	unos_goriva	evidencija_goriva	INSERT	123	2026-04-13 13:43:42.208896+00
617	unos_goriva	evidencija_goriva	INSERT	124	2026-04-13 13:43:42.208896+00
618	unos_goriva	evidencija_goriva	INSERT	125	2026-04-13 13:43:42.208896+00
619	unos_goriva	evidencija_goriva	INSERT	126	2026-04-13 13:43:42.208896+00
620	unos_goriva	evidencija_goriva	INSERT	127	2026-04-13 13:43:42.208896+00
621	unos_goriva	evidencija_goriva	INSERT	128	2026-04-13 13:43:42.208896+00
622	unos_goriva	evidencija_goriva	INSERT	129	2026-04-13 13:43:42.208896+00
623	unos_goriva	evidencija_goriva	INSERT	130	2026-04-13 13:43:42.208896+00
624	unos_goriva	evidencija_goriva	INSERT	131	2026-04-13 13:43:42.208896+00
625	unos_goriva	evidencija_goriva	INSERT	132	2026-04-13 13:43:42.208896+00
626	unos_goriva	evidencija_goriva	INSERT	133	2026-04-13 13:43:42.208896+00
627	unos_goriva	evidencija_goriva	INSERT	134	2026-04-13 13:43:42.208896+00
628	unos_goriva	evidencija_goriva	INSERT	135	2026-04-13 13:43:42.208896+00
629	unos_goriva	evidencija_goriva	INSERT	136	2026-04-13 13:43:42.208896+00
630	unos_goriva	evidencija_goriva	INSERT	137	2026-04-13 13:43:42.208896+00
631	unos_goriva	evidencija_goriva	INSERT	138	2026-04-13 13:43:42.208896+00
632	unos_goriva	evidencija_goriva	INSERT	139	2026-04-13 13:43:42.208896+00
633	unos_goriva	evidencija_goriva	INSERT	140	2026-04-13 13:43:42.208896+00
634	unos_goriva	evidencija_goriva	INSERT	141	2026-04-13 13:43:42.208896+00
635	unos_goriva	evidencija_goriva	INSERT	142	2026-04-13 13:43:42.208896+00
636	unos_goriva	evidencija_goriva	INSERT	143	2026-04-13 13:43:42.208896+00
637	unos_goriva	evidencija_goriva	INSERT	144	2026-04-13 13:43:42.208896+00
638	unos_goriva	evidencija_goriva	INSERT	145	2026-04-13 13:43:42.208896+00
639	unos_goriva	evidencija_goriva	INSERT	146	2026-04-13 13:43:42.208896+00
640	unos_goriva	evidencija_goriva	INSERT	147	2026-04-13 13:43:42.208896+00
641	unos_goriva	evidencija_goriva	INSERT	148	2026-04-13 13:43:42.208896+00
642	unos_goriva	evidencija_goriva	INSERT	149	2026-04-13 13:43:42.208896+00
643	unos_goriva	evidencija_goriva	INSERT	150	2026-04-13 13:43:42.208896+00
644	unos_goriva	evidencija_goriva	INSERT	151	2026-04-13 13:43:42.208896+00
645	unos_goriva	evidencija_goriva	INSERT	152	2026-04-13 13:43:42.208896+00
646	unos_goriva	evidencija_goriva	INSERT	153	2026-04-13 13:43:42.208896+00
647	unos_goriva	evidencija_goriva	INSERT	154	2026-04-13 13:43:42.208896+00
648	unos_goriva	evidencija_goriva	INSERT	155	2026-04-13 13:43:42.208896+00
649	unos_goriva	evidencija_goriva	INSERT	156	2026-04-13 13:43:42.208896+00
650	unos_goriva	evidencija_goriva	INSERT	157	2026-04-13 13:43:42.208896+00
651	unos_goriva	evidencija_goriva	INSERT	158	2026-04-13 13:43:42.208896+00
652	unos_goriva	evidencija_goriva	INSERT	159	2026-04-13 13:43:42.208896+00
653	unos_goriva	evidencija_goriva	INSERT	160	2026-04-13 13:43:42.208896+00
654	unos_goriva	evidencija_goriva	INSERT	161	2026-04-13 13:43:42.208896+00
655	unos_goriva	evidencija_goriva	INSERT	162	2026-04-13 13:43:42.208896+00
656	unos_goriva	evidencija_goriva	INSERT	163	2026-04-13 13:43:42.208896+00
657	unos_goriva	evidencija_goriva	INSERT	164	2026-04-13 13:43:42.208896+00
658	unos_goriva	evidencija_goriva	INSERT	165	2026-04-13 13:43:42.208896+00
659	unos_goriva	evidencija_goriva	INSERT	166	2026-04-13 13:43:42.208896+00
660	unos_goriva	evidencija_goriva	INSERT	167	2026-04-13 13:43:42.208896+00
661	unos_goriva	evidencija_goriva	INSERT	168	2026-04-13 13:43:42.208896+00
662	unos_goriva	evidencija_goriva	INSERT	169	2026-04-13 13:43:42.208896+00
663	unos_goriva	evidencija_goriva	INSERT	170	2026-04-13 13:43:42.208896+00
664	unos_goriva	evidencija_goriva	INSERT	171	2026-04-13 13:43:42.208896+00
665	unos_goriva	evidencija_goriva	INSERT	172	2026-04-13 13:43:42.208896+00
666	unos_goriva	evidencija_goriva	INSERT	173	2026-04-13 13:43:42.208896+00
667	unos_goriva	evidencija_goriva	INSERT	174	2026-04-13 13:43:42.208896+00
668	unos_goriva	evidencija_goriva	INSERT	175	2026-04-13 13:43:42.208896+00
669	unos_goriva	evidencija_goriva	INSERT	176	2026-04-13 13:43:42.208896+00
670	unos_goriva	evidencija_goriva	INSERT	177	2026-04-13 13:43:42.208896+00
671	unos_goriva	evidencija_goriva	INSERT	178	2026-04-13 13:43:42.208896+00
672	unos_goriva	evidencija_goriva	INSERT	179	2026-04-13 13:43:42.208896+00
673	unos_goriva	evidencija_goriva	INSERT	180	2026-04-13 13:43:42.208896+00
674	unos_goriva	evidencija_goriva	INSERT	181	2026-04-13 13:43:42.208896+00
675	unos_goriva	evidencija_goriva	INSERT	182	2026-04-13 13:43:42.208896+00
676	unos_goriva	evidencija_goriva	INSERT	183	2026-04-13 13:43:42.208896+00
677	unos_goriva	evidencija_goriva	INSERT	184	2026-04-13 13:43:42.208896+00
678	unos_goriva	evidencija_goriva	INSERT	185	2026-04-13 13:43:42.208896+00
679	unos_goriva	evidencija_goriva	INSERT	186	2026-04-13 13:43:42.208896+00
680	unos_goriva	evidencija_goriva	INSERT	187	2026-04-13 13:43:42.208896+00
681	unos_goriva	evidencija_goriva	INSERT	188	2026-04-13 13:43:42.208896+00
682	unos_goriva	evidencija_goriva	INSERT	189	2026-04-13 13:43:42.208896+00
683	unos_goriva	evidencija_goriva	INSERT	190	2026-04-13 13:43:42.208896+00
684	unos_goriva	evidencija_goriva	INSERT	191	2026-04-13 13:43:42.208896+00
685	unos_goriva	evidencija_goriva	INSERT	192	2026-04-13 13:43:42.208896+00
686	unos_goriva	evidencija_goriva	INSERT	193	2026-04-13 13:43:42.208896+00
687	unos_goriva	evidencija_goriva	INSERT	194	2026-04-13 13:43:42.208896+00
688	unos_goriva	evidencija_goriva	INSERT	195	2026-04-13 13:43:42.208896+00
689	unos_goriva	evidencija_goriva	INSERT	196	2026-04-13 13:43:42.208896+00
690	unos_goriva	evidencija_goriva	INSERT	197	2026-04-13 13:43:42.208896+00
691	unos_goriva	evidencija_goriva	INSERT	198	2026-04-13 13:43:42.208896+00
692	unos_goriva	evidencija_goriva	INSERT	199	2026-04-13 13:43:42.208896+00
693	unos_goriva	evidencija_goriva	INSERT	200	2026-04-13 13:43:42.208896+00
694	unos_goriva	evidencija_goriva	INSERT	201	2026-04-13 13:43:42.208896+00
695	unos_goriva	evidencija_goriva	INSERT	202	2026-04-13 13:43:42.208896+00
696	unos_goriva	evidencija_goriva	INSERT	203	2026-04-13 13:43:42.208896+00
697	unos_goriva	evidencija_goriva	INSERT	204	2026-04-13 13:43:42.208896+00
698	unos_goriva	evidencija_goriva	INSERT	205	2026-04-13 13:43:42.208896+00
699	unos_goriva	evidencija_goriva	INSERT	206	2026-04-13 13:43:42.208896+00
700	unos_goriva	evidencija_goriva	INSERT	207	2026-04-13 13:43:42.208896+00
701	unos_goriva	evidencija_goriva	INSERT	208	2026-04-13 13:43:42.208896+00
702	unos_goriva	evidencija_goriva	INSERT	209	2026-04-13 13:43:42.208896+00
703	unos_goriva	evidencija_goriva	INSERT	210	2026-04-13 13:43:42.208896+00
704	unos_goriva	evidencija_goriva	INSERT	211	2026-04-13 13:43:42.208896+00
705	unos_goriva	evidencija_goriva	INSERT	212	2026-04-13 13:43:42.208896+00
706	unos_goriva	evidencija_goriva	INSERT	213	2026-04-13 13:43:42.208896+00
707	unos_goriva	evidencija_goriva	INSERT	214	2026-04-13 13:43:42.208896+00
708	unos_goriva	evidencija_goriva	INSERT	215	2026-04-13 13:43:42.208896+00
709	unos_goriva	evidencija_goriva	INSERT	216	2026-04-13 13:43:42.208896+00
710	unos_goriva	evidencija_goriva	INSERT	217	2026-04-13 13:43:42.208896+00
711	unos_goriva	evidencija_goriva	INSERT	218	2026-04-13 13:43:42.208896+00
712	unos_goriva	evidencija_goriva	INSERT	219	2026-04-13 13:43:42.208896+00
713	unos_goriva	evidencija_goriva	INSERT	220	2026-04-13 13:43:42.208896+00
714	unos_goriva	evidencija_goriva	INSERT	221	2026-04-13 13:43:42.208896+00
715	unos_goriva	evidencija_goriva	INSERT	222	2026-04-13 13:43:42.208896+00
716	unos_goriva	evidencija_goriva	INSERT	223	2026-04-13 13:43:42.208896+00
717	unos_goriva	evidencija_goriva	INSERT	224	2026-04-13 13:43:42.208896+00
718	unos_goriva	evidencija_goriva	INSERT	225	2026-04-13 13:43:42.208896+00
719	unos_goriva	evidencija_goriva	INSERT	226	2026-04-13 13:43:42.208896+00
720	unos_goriva	evidencija_goriva	INSERT	227	2026-04-13 13:43:42.208896+00
721	unos_goriva	evidencija_goriva	INSERT	228	2026-04-13 13:43:42.208896+00
722	unos_goriva	evidencija_goriva	INSERT	229	2026-04-13 13:43:42.208896+00
723	unos_goriva	evidencija_goriva	INSERT	230	2026-04-13 13:43:42.208896+00
724	unos_goriva	evidencija_goriva	INSERT	231	2026-04-13 13:43:42.208896+00
725	unos_goriva	evidencija_goriva	INSERT	232	2026-04-13 13:43:42.208896+00
726	unos_goriva	evidencija_goriva	INSERT	233	2026-04-13 13:43:42.208896+00
727	unos_goriva	evidencija_goriva	INSERT	234	2026-04-13 13:43:42.208896+00
728	unos_goriva	evidencija_goriva	INSERT	235	2026-04-13 13:43:42.208896+00
729	unos_goriva	evidencija_goriva	INSERT	236	2026-04-13 13:43:42.208896+00
730	unos_goriva	evidencija_goriva	INSERT	237	2026-04-13 13:43:42.208896+00
731	unos_goriva	evidencija_goriva	INSERT	238	2026-04-13 13:43:42.208896+00
732	unos_goriva	evidencija_goriva	INSERT	239	2026-04-13 13:43:42.208896+00
733	unos_goriva	evidencija_goriva	INSERT	240	2026-04-13 13:43:42.208896+00
734	unos_goriva	evidencija_goriva	INSERT	241	2026-04-13 13:43:42.208896+00
735	unos_goriva	evidencija_goriva	INSERT	242	2026-04-13 13:43:42.208896+00
736	unos_goriva	evidencija_goriva	INSERT	243	2026-04-13 13:43:42.208896+00
737	unos_goriva	evidencija_goriva	INSERT	244	2026-04-13 13:43:42.208896+00
738	unos_goriva	evidencija_goriva	INSERT	245	2026-04-13 13:43:42.208896+00
739	unos_goriva	evidencija_goriva	INSERT	246	2026-04-13 13:43:42.208896+00
740	unos_goriva	evidencija_goriva	INSERT	247	2026-04-13 13:43:42.208896+00
741	unos_goriva	evidencija_goriva	INSERT	248	2026-04-13 13:43:42.208896+00
742	unos_goriva	evidencija_goriva	INSERT	249	2026-04-13 13:43:42.208896+00
743	unos_goriva	evidencija_goriva	INSERT	250	2026-04-13 13:43:42.208896+00
744	unos_goriva	evidencija_goriva	INSERT	251	2026-04-13 13:43:42.208896+00
745	unos_goriva	evidencija_goriva	INSERT	252	2026-04-13 13:43:42.208896+00
746	unos_goriva	evidencija_goriva	INSERT	253	2026-04-13 13:43:42.208896+00
747	unos_goriva	evidencija_goriva	INSERT	254	2026-04-13 13:43:42.208896+00
748	unos_goriva	evidencija_goriva	INSERT	255	2026-04-13 13:43:42.208896+00
749	unos_goriva	evidencija_goriva	INSERT	256	2026-04-13 13:43:42.208896+00
750	unos_goriva	evidencija_goriva	INSERT	257	2026-04-13 13:43:42.208896+00
751	unos_goriva	evidencija_goriva	INSERT	258	2026-04-13 13:43:42.208896+00
752	unos_goriva	evidencija_goriva	INSERT	259	2026-04-13 13:43:42.208896+00
753	unos_goriva	evidencija_goriva	INSERT	260	2026-04-13 13:43:42.208896+00
754	unos_goriva	evidencija_goriva	INSERT	261	2026-04-13 13:43:42.208896+00
755	unos_goriva	evidencija_goriva	INSERT	262	2026-04-13 13:43:42.208896+00
756	unos_goriva	evidencija_goriva	INSERT	263	2026-04-13 13:43:42.208896+00
757	unos_goriva	evidencija_goriva	INSERT	264	2026-04-13 13:43:42.208896+00
758	unos_goriva	evidencija_goriva	INSERT	265	2026-04-13 13:43:42.208896+00
759	unos_goriva	evidencija_goriva	INSERT	266	2026-04-13 13:43:42.208896+00
760	unos_goriva	evidencija_goriva	INSERT	267	2026-04-13 13:43:42.208896+00
761	unos_goriva	evidencija_goriva	INSERT	268	2026-04-13 13:43:42.208896+00
762	unos_goriva	evidencija_goriva	INSERT	269	2026-04-13 13:43:42.208896+00
763	unos_goriva	evidencija_goriva	INSERT	270	2026-04-13 13:43:42.208896+00
764	unos_goriva	evidencija_goriva	INSERT	271	2026-04-13 13:43:42.208896+00
765	unos_goriva	evidencija_goriva	INSERT	272	2026-04-13 13:43:42.208896+00
766	unos_goriva	evidencija_goriva	INSERT	273	2026-04-13 13:43:42.208896+00
767	unos_goriva	evidencija_goriva	INSERT	274	2026-04-13 13:43:42.208896+00
768	unos_goriva	evidencija_goriva	INSERT	275	2026-04-13 13:43:42.208896+00
769	unos_goriva	evidencija_goriva	INSERT	276	2026-04-13 13:43:42.208896+00
770	unos_goriva	evidencija_goriva	INSERT	277	2026-04-13 13:43:42.208896+00
771	unos_goriva	evidencija_goriva	INSERT	278	2026-04-13 13:43:42.208896+00
772	unos_goriva	evidencija_goriva	INSERT	279	2026-04-13 13:43:42.208896+00
773	unos_goriva	evidencija_goriva	INSERT	280	2026-04-13 13:43:42.208896+00
774	unos_goriva	evidencija_goriva	INSERT	281	2026-04-13 13:43:42.208896+00
775	unos_goriva	evidencija_goriva	INSERT	282	2026-04-13 13:43:42.208896+00
776	unos_goriva	evidencija_goriva	INSERT	283	2026-04-13 13:43:42.208896+00
777	unos_goriva	evidencija_goriva	INSERT	284	2026-04-13 13:43:42.208896+00
778	unos_goriva	evidencija_goriva	INSERT	285	2026-04-13 13:43:42.208896+00
779	unos_goriva	evidencija_goriva	INSERT	286	2026-04-13 13:43:42.208896+00
780	unos_goriva	evidencija_goriva	INSERT	287	2026-04-13 13:43:42.208896+00
781	unos_goriva	evidencija_goriva	INSERT	288	2026-04-13 13:43:42.208896+00
782	unos_goriva	evidencija_goriva	INSERT	289	2026-04-13 13:43:42.208896+00
783	unos_goriva	evidencija_goriva	INSERT	290	2026-04-13 13:43:42.208896+00
784	unos_goriva	evidencija_goriva	INSERT	291	2026-04-13 13:43:42.208896+00
785	unos_goriva	evidencija_goriva	INSERT	292	2026-04-13 13:43:42.208896+00
786	unos_goriva	evidencija_goriva	INSERT	293	2026-04-13 13:43:42.208896+00
787	unos_goriva	evidencija_goriva	INSERT	294	2026-04-13 13:43:42.208896+00
788	unos_goriva	evidencija_goriva	INSERT	295	2026-04-13 13:43:42.208896+00
789	unos_goriva	evidencija_goriva	INSERT	296	2026-04-13 13:43:42.208896+00
790	unos_goriva	evidencija_goriva	INSERT	297	2026-04-13 13:43:42.208896+00
791	unos_goriva	evidencija_goriva	INSERT	298	2026-04-13 13:43:42.208896+00
792	unos_goriva	evidencija_goriva	INSERT	299	2026-04-13 13:43:42.208896+00
793	unos_goriva	evidencija_goriva	INSERT	300	2026-04-13 13:43:42.208896+00
794	unos_goriva	evidencija_goriva	INSERT	301	2026-04-13 13:43:42.208896+00
795	unos_goriva	evidencija_goriva	INSERT	302	2026-04-13 13:43:42.208896+00
796	unos_goriva	evidencija_goriva	INSERT	303	2026-04-13 13:43:42.208896+00
797	unos_goriva	evidencija_goriva	INSERT	304	2026-04-13 13:43:42.208896+00
798	unos_goriva	evidencija_goriva	INSERT	305	2026-04-13 13:43:42.208896+00
799	unos_goriva	evidencija_goriva	INSERT	306	2026-04-13 13:43:42.208896+00
800	unos_goriva	evidencija_goriva	INSERT	307	2026-04-13 13:43:42.208896+00
801	unos_goriva	evidencija_goriva	INSERT	308	2026-04-13 13:43:42.208896+00
802	unos_goriva	evidencija_goriva	INSERT	309	2026-04-13 13:43:42.208896+00
803	unos_goriva	evidencija_goriva	INSERT	310	2026-04-13 13:43:42.208896+00
804	unos_goriva	evidencija_goriva	INSERT	311	2026-04-13 13:43:42.208896+00
805	unos_goriva	evidencija_goriva	INSERT	312	2026-04-13 13:43:42.208896+00
806	unos_goriva	evidencija_goriva	INSERT	313	2026-04-13 13:43:42.208896+00
807	unos_goriva	evidencija_goriva	INSERT	314	2026-04-13 13:43:42.208896+00
808	unos_goriva	evidencija_goriva	INSERT	315	2026-04-13 13:43:42.208896+00
809	unos_goriva	evidencija_goriva	INSERT	316	2026-04-13 13:43:42.208896+00
810	unos_goriva	evidencija_goriva	INSERT	317	2026-04-13 13:43:42.208896+00
811	unos_goriva	evidencija_goriva	INSERT	318	2026-04-13 13:43:42.208896+00
812	unos_goriva	evidencija_goriva	INSERT	319	2026-04-13 13:43:42.208896+00
813	unos_goriva	evidencija_goriva	INSERT	320	2026-04-13 13:43:42.208896+00
814	unos_goriva	evidencija_goriva	INSERT	321	2026-04-13 13:43:42.208896+00
815	unos_goriva	evidencija_goriva	INSERT	322	2026-04-13 13:43:42.208896+00
816	unos_goriva	evidencija_goriva	INSERT	323	2026-04-13 13:43:42.208896+00
817	unos_goriva	evidencija_goriva	INSERT	324	2026-04-13 13:43:42.208896+00
818	unos_goriva	evidencija_goriva	INSERT	325	2026-04-13 13:43:42.208896+00
819	unos_goriva	evidencija_goriva	INSERT	326	2026-04-13 13:43:42.208896+00
820	unos_goriva	evidencija_goriva	INSERT	327	2026-04-13 13:43:42.208896+00
821	unos_goriva	evidencija_goriva	INSERT	328	2026-04-13 13:43:42.208896+00
822	unos_goriva	evidencija_goriva	INSERT	329	2026-04-13 13:43:42.208896+00
823	unos_goriva	evidencija_goriva	INSERT	330	2026-04-13 13:43:42.208896+00
824	unos_goriva	evidencija_goriva	INSERT	331	2026-04-13 13:43:42.208896+00
825	unos_goriva	evidencija_goriva	INSERT	332	2026-04-13 13:43:42.208896+00
826	unos_goriva	evidencija_goriva	INSERT	333	2026-04-13 13:43:42.208896+00
827	unos_goriva	evidencija_goriva	INSERT	334	2026-04-13 13:43:42.208896+00
828	unos_goriva	evidencija_goriva	INSERT	335	2026-04-13 13:43:42.208896+00
829	unos_goriva	evidencija_goriva	INSERT	336	2026-04-13 13:43:42.208896+00
830	unos_goriva	evidencija_goriva	INSERT	337	2026-04-13 13:43:42.208896+00
831	unos_goriva	evidencija_goriva	INSERT	338	2026-04-13 13:43:42.208896+00
832	unos_goriva	evidencija_goriva	INSERT	339	2026-04-13 13:43:42.208896+00
833	unos_goriva	evidencija_goriva	INSERT	340	2026-04-13 13:43:42.208896+00
834	unos_goriva	evidencija_goriva	INSERT	341	2026-04-13 13:43:42.208896+00
835	unos_goriva	evidencija_goriva	INSERT	342	2026-04-13 13:43:42.208896+00
836	unos_goriva	evidencija_goriva	INSERT	343	2026-04-13 13:43:42.208896+00
837	unos_goriva	evidencija_goriva	INSERT	344	2026-04-13 13:43:42.208896+00
838	unos_goriva	evidencija_goriva	INSERT	345	2026-04-13 13:43:42.208896+00
839	unos_goriva	evidencija_goriva	INSERT	346	2026-04-13 13:43:42.208896+00
840	unos_goriva	evidencija_goriva	INSERT	347	2026-04-13 13:43:42.208896+00
841	unos_goriva	evidencija_goriva	INSERT	348	2026-04-13 13:43:42.208896+00
842	unos_goriva	evidencija_goriva	INSERT	349	2026-04-13 13:43:42.208896+00
843	unos_goriva	evidencija_goriva	INSERT	350	2026-04-13 13:43:42.208896+00
844	unos_goriva	evidencija_goriva	INSERT	351	2026-04-13 13:43:42.208896+00
845	unos_goriva	evidencija_goriva	INSERT	352	2026-04-13 13:43:42.208896+00
846	unos_goriva	evidencija_goriva	INSERT	353	2026-04-13 13:43:42.208896+00
847	unos_goriva	evidencija_goriva	INSERT	354	2026-04-13 13:43:42.208896+00
848	unos_goriva	evidencija_goriva	INSERT	355	2026-04-13 13:43:42.208896+00
849	unos_goriva	evidencija_goriva	INSERT	356	2026-04-13 13:43:42.208896+00
850	unos_goriva	evidencija_goriva	INSERT	357	2026-04-13 13:43:42.208896+00
851	unos_goriva	evidencija_goriva	INSERT	358	2026-04-13 13:43:42.208896+00
852	unos_goriva	evidencija_goriva	INSERT	359	2026-04-13 13:43:42.208896+00
853	unos_goriva	evidencija_goriva	INSERT	360	2026-04-13 13:43:42.208896+00
854	unos_goriva	evidencija_goriva	INSERT	361	2026-04-13 13:43:42.208896+00
855	unos_goriva	evidencija_goriva	INSERT	362	2026-04-13 13:43:42.208896+00
856	unos_goriva	evidencija_goriva	INSERT	363	2026-04-13 13:43:42.208896+00
857	unos_goriva	evidencija_goriva	INSERT	364	2026-04-13 13:43:42.208896+00
858	unos_goriva	evidencija_goriva	INSERT	365	2026-04-13 13:43:42.208896+00
859	unos_goriva	evidencija_goriva	INSERT	366	2026-04-13 13:43:42.208896+00
860	unos_goriva	evidencija_goriva	INSERT	367	2026-04-13 13:43:42.208896+00
861	unos_goriva	evidencija_goriva	INSERT	368	2026-04-13 13:43:42.208896+00
862	unos_goriva	evidencija_goriva	INSERT	369	2026-04-13 13:43:42.208896+00
863	unos_goriva	evidencija_goriva	INSERT	370	2026-04-13 13:43:42.208896+00
864	unos_goriva	evidencija_goriva	INSERT	371	2026-04-13 13:43:42.208896+00
865	unos_goriva	evidencija_goriva	INSERT	372	2026-04-13 13:43:42.208896+00
866	unos_goriva	evidencija_goriva	INSERT	373	2026-04-13 13:43:42.208896+00
867	unos_goriva	evidencija_goriva	INSERT	374	2026-04-13 13:43:42.208896+00
868	unos_goriva	evidencija_goriva	INSERT	375	2026-04-13 13:43:42.208896+00
869	unos_goriva	evidencija_goriva	INSERT	376	2026-04-13 13:43:42.208896+00
870	unos_goriva	evidencija_goriva	INSERT	377	2026-04-13 13:43:42.208896+00
871	unos_goriva	evidencija_goriva	INSERT	378	2026-04-13 13:43:42.208896+00
872	unos_goriva	evidencija_goriva	INSERT	379	2026-04-13 13:43:42.208896+00
873	unos_goriva	evidencija_goriva	INSERT	380	2026-04-13 13:43:42.208896+00
874	unos_goriva	evidencija_goriva	INSERT	381	2026-04-13 13:43:42.208896+00
875	unos_goriva	evidencija_goriva	INSERT	382	2026-04-13 13:43:42.208896+00
876	unos_goriva	evidencija_goriva	INSERT	383	2026-04-13 13:43:42.208896+00
877	unos_goriva	evidencija_goriva	INSERT	384	2026-04-13 13:43:42.208896+00
878	unos_goriva	evidencija_goriva	INSERT	385	2026-04-13 13:43:42.208896+00
879	unos_goriva	evidencija_goriva	INSERT	386	2026-04-13 13:43:42.208896+00
880	unos_goriva	evidencija_goriva	INSERT	387	2026-04-13 13:43:42.208896+00
881	unos_goriva	evidencija_goriva	INSERT	388	2026-04-13 13:43:42.208896+00
882	unos_goriva	evidencija_goriva	INSERT	389	2026-04-13 13:43:42.208896+00
883	unos_goriva	evidencija_goriva	INSERT	390	2026-04-13 13:43:42.208896+00
884	unos_goriva	evidencija_goriva	INSERT	391	2026-04-13 13:43:42.208896+00
885	unos_goriva	evidencija_goriva	INSERT	392	2026-04-13 13:43:42.208896+00
886	unos_goriva	evidencija_goriva	INSERT	393	2026-04-13 13:43:42.208896+00
887	unos_goriva	evidencija_goriva	INSERT	394	2026-04-13 13:43:42.208896+00
888	unos_goriva	evidencija_goriva	INSERT	395	2026-04-13 13:43:42.208896+00
889	unos_goriva	evidencija_goriva	INSERT	396	2026-04-13 13:43:42.208896+00
890	unos_goriva	evidencija_goriva	INSERT	397	2026-04-13 13:43:42.208896+00
891	unos_goriva	evidencija_goriva	INSERT	398	2026-04-13 13:43:42.208896+00
892	unos_goriva	evidencija_goriva	INSERT	399	2026-04-13 13:43:42.208896+00
893	unos_goriva	evidencija_goriva	INSERT	400	2026-04-13 13:43:42.208896+00
894	unos_goriva	evidencija_goriva	INSERT	401	2026-04-13 13:43:42.208896+00
895	unos_goriva	evidencija_goriva	INSERT	402	2026-04-13 13:43:42.208896+00
896	unos_goriva	evidencija_goriva	INSERT	403	2026-04-13 13:43:42.208896+00
897	unos_goriva	evidencija_goriva	INSERT	404	2026-04-13 13:43:42.208896+00
898	unos_goriva	evidencija_goriva	INSERT	405	2026-04-13 13:43:42.208896+00
899	unos_goriva	evidencija_goriva	INSERT	406	2026-04-13 13:43:42.208896+00
900	unos_goriva	evidencija_goriva	INSERT	407	2026-04-13 13:43:42.208896+00
901	unos_goriva	evidencija_goriva	INSERT	408	2026-04-13 13:43:42.208896+00
902	unos_goriva	evidencija_goriva	INSERT	409	2026-04-13 13:43:42.208896+00
903	unos_goriva	evidencija_goriva	INSERT	410	2026-04-13 13:43:42.208896+00
904	unos_goriva	evidencija_goriva	INSERT	411	2026-04-13 13:43:42.208896+00
905	unos_goriva	evidencija_goriva	INSERT	412	2026-04-13 13:43:42.208896+00
906	unos_goriva	evidencija_goriva	INSERT	413	2026-04-13 13:43:42.208896+00
907	unos_goriva	evidencija_goriva	INSERT	414	2026-04-13 13:43:42.208896+00
908	unos_goriva	evidencija_goriva	INSERT	415	2026-04-13 13:43:42.208896+00
909	unos_goriva	evidencija_goriva	INSERT	416	2026-04-13 13:43:42.208896+00
910	unos_goriva	evidencija_goriva	INSERT	417	2026-04-13 13:43:42.208896+00
911	unos_goriva	evidencija_goriva	INSERT	418	2026-04-13 13:43:42.208896+00
912	unos_goriva	evidencija_goriva	INSERT	419	2026-04-13 13:43:42.208896+00
913	unos_goriva	evidencija_goriva	INSERT	420	2026-04-13 13:43:42.208896+00
914	unos_goriva	evidencija_goriva	INSERT	421	2026-04-13 13:43:42.208896+00
915	unos_goriva	evidencija_goriva	INSERT	422	2026-04-13 13:43:42.208896+00
916	unos_goriva	evidencija_goriva	INSERT	423	2026-04-13 13:43:42.208896+00
917	unos_goriva	evidencija_goriva	INSERT	424	2026-04-13 13:43:42.208896+00
918	unos_goriva	evidencija_goriva	INSERT	425	2026-04-13 13:43:42.208896+00
919	unos_goriva	evidencija_goriva	INSERT	426	2026-04-13 13:43:42.208896+00
920	unos_goriva	evidencija_goriva	INSERT	427	2026-04-13 13:43:42.208896+00
921	unos_goriva	evidencija_goriva	INSERT	428	2026-04-13 13:43:42.208896+00
922	unos_goriva	evidencija_goriva	INSERT	429	2026-04-13 13:43:42.208896+00
923	unos_goriva	evidencija_goriva	INSERT	430	2026-04-13 13:43:42.208896+00
924	unos_goriva	evidencija_goriva	INSERT	431	2026-04-13 13:43:42.208896+00
925	unos_goriva	evidencija_goriva	INSERT	432	2026-04-13 13:43:42.208896+00
926	unos_goriva	evidencija_goriva	INSERT	433	2026-04-13 13:43:42.208896+00
927	unos_goriva	evidencija_goriva	INSERT	434	2026-04-13 13:43:42.208896+00
928	unos_goriva	evidencija_goriva	INSERT	435	2026-04-13 13:43:42.208896+00
929	unos_goriva	evidencija_goriva	INSERT	436	2026-04-13 13:43:42.208896+00
930	unos_goriva	evidencija_goriva	INSERT	437	2026-04-13 13:43:42.208896+00
931	unos_goriva	evidencija_goriva	INSERT	438	2026-04-13 13:43:42.208896+00
932	unos_goriva	evidencija_goriva	INSERT	439	2026-04-13 13:43:42.208896+00
933	unos_goriva	evidencija_goriva	INSERT	440	2026-04-13 13:43:42.208896+00
934	unos_goriva	evidencija_goriva	INSERT	441	2026-04-13 13:43:42.208896+00
935	unos_goriva	evidencija_goriva	INSERT	442	2026-04-13 13:43:42.208896+00
936	unos_goriva	evidencija_goriva	INSERT	443	2026-04-13 13:43:42.208896+00
937	unos_goriva	evidencija_goriva	INSERT	444	2026-04-13 13:43:42.208896+00
938	unos_goriva	evidencija_goriva	INSERT	445	2026-04-13 13:43:42.208896+00
939	unos_goriva	evidencija_goriva	INSERT	446	2026-04-13 13:43:42.208896+00
940	unos_goriva	evidencija_goriva	INSERT	447	2026-04-13 13:43:42.208896+00
941	unos_goriva	evidencija_goriva	INSERT	448	2026-04-13 13:43:42.208896+00
942	nova_prijava_kvara	servisne_intervencije	INSERT	41	2026-04-13 13:43:42.208896+00
943	nova_prijava_kvara	servisne_intervencije	INSERT	42	2026-04-13 13:43:42.208896+00
944	nova_prijava_kvara	servisne_intervencije	INSERT	43	2026-04-13 13:43:42.208896+00
945	nova_prijava_kvara	servisne_intervencije	INSERT	44	2026-04-13 13:43:42.208896+00
946	nova_prijava_kvara	servisne_intervencije	INSERT	45	2026-04-13 13:43:42.208896+00
947	nova_prijava_kvara	servisne_intervencije	INSERT	46	2026-04-13 13:43:42.208896+00
948	nova_prijava_kvara	servisne_intervencije	INSERT	47	2026-04-13 13:43:42.208896+00
949	nova_prijava_kvara	servisne_intervencije	INSERT	48	2026-04-13 13:43:42.208896+00
950	nova_prijava_kvara	servisne_intervencije	INSERT	49	2026-04-13 13:43:42.208896+00
951	nova_prijava_kvara	servisne_intervencije	INSERT	50	2026-04-13 13:43:42.208896+00
952	nova_prijava_kvara	servisne_intervencije	INSERT	51	2026-04-13 13:43:42.208896+00
953	nova_prijava_kvara	servisne_intervencije	INSERT	52	2026-04-13 13:43:42.208896+00
954	nova_prijava_kvara	servisne_intervencije	INSERT	53	2026-04-13 13:43:42.208896+00
955	nova_prijava_kvara	servisne_intervencije	INSERT	54	2026-04-13 13:43:42.208896+00
956	nova_prijava_kvara	servisne_intervencije	INSERT	55	2026-04-13 13:43:42.208896+00
957	nova_prijava_kvara	servisne_intervencije	INSERT	56	2026-04-13 13:43:42.208896+00
958	nova_prijava_kvara	servisne_intervencije	INSERT	57	2026-04-13 13:43:42.208896+00
959	nova_prijava_kvara	servisne_intervencije	INSERT	58	2026-04-13 13:43:42.208896+00
960	nova_prijava_kvara	servisne_intervencije	INSERT	59	2026-04-13 13:43:42.208896+00
961	nova_prijava_kvara	servisne_intervencije	INSERT	60	2026-04-13 13:43:42.208896+00
962	nova_prijava_kvara	servisne_intervencije	INSERT	61	2026-04-13 13:43:42.208896+00
963	nova_prijava_kvara	servisne_intervencije	INSERT	62	2026-04-13 13:43:42.208896+00
964	nova_prijava_kvara	servisne_intervencije	INSERT	63	2026-04-13 13:43:42.208896+00
965	nova_prijava_kvara	servisne_intervencije	INSERT	64	2026-04-13 13:43:42.208896+00
966	nova_prijava_kvara	servisne_intervencije	INSERT	65	2026-04-13 13:43:42.208896+00
967	nova_prijava_kvara	servisne_intervencije	INSERT	66	2026-04-13 13:43:42.208896+00
968	nova_prijava_kvara	servisne_intervencije	INSERT	67	2026-04-13 13:43:42.208896+00
969	nova_prijava_kvara	servisne_intervencije	INSERT	68	2026-04-13 13:43:42.208896+00
970	nova_prijava_kvara	servisne_intervencije	INSERT	69	2026-04-13 13:43:42.208896+00
971	nova_prijava_kvara	servisne_intervencije	INSERT	70	2026-04-13 13:43:42.208896+00
972	nova_prijava_kvara	servisne_intervencije	INSERT	71	2026-04-13 13:43:42.208896+00
973	nova_prijava_kvara	servisne_intervencije	INSERT	72	2026-04-13 13:43:42.208896+00
974	nova_prijava_kvara	servisne_intervencije	INSERT	73	2026-04-13 13:43:42.208896+00
975	nova_prijava_kvara	servisne_intervencije	INSERT	74	2026-04-13 13:43:42.208896+00
976	nova_prijava_kvara	servisne_intervencije	INSERT	75	2026-04-13 13:43:42.208896+00
977	nova_prijava_kvara	servisne_intervencije	INSERT	76	2026-04-13 13:43:42.208896+00
978	nova_prijava_kvara	servisne_intervencije	INSERT	77	2026-04-13 13:43:42.208896+00
979	nova_prijava_kvara	servisne_intervencije	INSERT	78	2026-04-13 13:43:42.208896+00
980	nova_prijava_kvara	servisne_intervencije	INSERT	79	2026-04-13 13:43:42.208896+00
981	nova_prijava_kvara	servisne_intervencije	INSERT	80	2026-04-13 13:43:42.208896+00
982	nova_prijava_kvara	servisne_intervencije	INSERT	81	2026-04-13 13:43:42.208896+00
983	nova_prijava_kvara	servisne_intervencije	INSERT	82	2026-04-13 13:43:42.208896+00
984	nova_prijava_kvara	servisne_intervencije	INSERT	83	2026-04-13 13:43:42.208896+00
985	nova_prijava_kvara	servisne_intervencije	INSERT	84	2026-04-13 13:43:42.208896+00
986	nova_prijava_kvara	servisne_intervencije	INSERT	85	2026-04-13 13:43:42.208896+00
987	nova_prijava_kvara	servisne_intervencije	INSERT	86	2026-04-13 13:43:42.208896+00
988	nova_prijava_kvara	servisne_intervencije	INSERT	87	2026-04-13 13:43:42.208896+00
989	nova_prijava_kvara	servisne_intervencije	INSERT	88	2026-04-13 13:43:42.208896+00
990	nova_prijava_kvara	servisne_intervencije	INSERT	89	2026-04-13 13:43:42.208896+00
991	nova_prijava_kvara	servisne_intervencije	INSERT	90	2026-04-13 13:43:42.208896+00
992	nova_prijava_kvara	servisne_intervencije	INSERT	91	2026-04-13 13:43:42.208896+00
993	nova_prijava_kvara	servisne_intervencije	INSERT	92	2026-04-13 13:43:42.208896+00
994	nova_prijava_kvara	servisne_intervencije	INSERT	93	2026-04-13 13:43:42.208896+00
995	nova_prijava_kvara	servisne_intervencije	INSERT	94	2026-04-13 13:43:42.208896+00
996	nova_prijava_kvara	servisne_intervencije	INSERT	95	2026-04-13 13:43:42.208896+00
997	nova_prijava_kvara	servisne_intervencije	INSERT	96	2026-04-13 13:43:42.208896+00
998	nova_prijava_kvara	servisne_intervencije	INSERT	97	2026-04-13 13:43:42.208896+00
999	nova_prijava_kvara	servisne_intervencije	INSERT	98	2026-04-13 13:43:42.208896+00
1000	nova_prijava_kvara	servisne_intervencije	INSERT	99	2026-04-13 13:43:42.208896+00
1001	nova_prijava_kvara	servisne_intervencije	INSERT	100	2026-04-13 13:43:42.208896+00
1002	nova_prijava_kvara	servisne_intervencije	INSERT	101	2026-04-13 13:43:42.208896+00
1003	nova_prijava_kvara	servisne_intervencije	INSERT	102	2026-04-13 13:43:42.208896+00
1004	nova_prijava_kvara	servisne_intervencije	INSERT	103	2026-04-13 13:43:42.208896+00
1005	nova_prijava_kvara	servisne_intervencije	INSERT	104	2026-04-13 13:43:42.208896+00
1006	nova_prijava_kvara	servisne_intervencije	INSERT	105	2026-04-13 13:43:42.208896+00
1007	nova_prijava_kvara	servisne_intervencije	INSERT	106	2026-04-13 13:43:42.208896+00
1008	nova_prijava_kvara	servisne_intervencije	INSERT	107	2026-04-13 13:43:42.208896+00
1009	nova_prijava_kvara	servisne_intervencije	INSERT	108	2026-04-13 13:43:42.208896+00
1010	nova_prijava_kvara	servisne_intervencije	INSERT	109	2026-04-13 13:43:42.208896+00
1011	nova_prijava_kvara	servisne_intervencije	INSERT	110	2026-04-13 13:43:42.208896+00
1012	nova_prijava_kvara	servisne_intervencije	INSERT	111	2026-04-13 13:43:42.208896+00
1013	nova_prijava_kvara	servisne_intervencije	INSERT	112	2026-04-13 13:43:42.208896+00
1014	nova_prijava_kvara	servisne_intervencije	INSERT	113	2026-04-13 13:43:42.208896+00
1015	nova_prijava_kvara	servisne_intervencije	INSERT	114	2026-04-13 13:43:42.208896+00
1016	nova_prijava_kvara	servisne_intervencije	INSERT	115	2026-04-13 13:43:42.208896+00
1017	nova_prijava_kvara	servisne_intervencije	INSERT	116	2026-04-13 13:43:42.208896+00
1018	nova_prijava_kvara	servisne_intervencije	INSERT	117	2026-04-13 13:43:42.208896+00
1019	nova_prijava_kvara	servisne_intervencije	INSERT	118	2026-04-13 13:43:42.208896+00
1020	nova_prijava_kvara	servisne_intervencije	INSERT	119	2026-04-13 13:43:42.208896+00
1021	nova_prijava_kvara	servisne_intervencije	INSERT	120	2026-04-13 13:43:42.208896+00
1022	nova_prijava_kvara	servisne_intervencije	INSERT	121	2026-04-13 13:43:42.208896+00
1023	nova_prijava_kvara	servisne_intervencije	INSERT	122	2026-04-13 13:43:42.208896+00
1024	nova_prijava_kvara	servisne_intervencije	INSERT	123	2026-04-13 13:43:42.208896+00
1025	nova_prijava_kvara	servisne_intervencije	INSERT	124	2026-04-13 13:43:42.208896+00
1026	nova_prijava_kvara	servisne_intervencije	INSERT	125	2026-04-13 13:43:42.208896+00
1027	nova_prijava_kvara	servisne_intervencije	INSERT	126	2026-04-13 13:43:42.208896+00
1028	nova_prijava_kvara	servisne_intervencije	INSERT	127	2026-04-13 13:43:42.208896+00
1029	nova_prijava_kvara	servisne_intervencije	INSERT	128	2026-04-13 13:43:42.208896+00
1030	nova_prijava_kvara	servisne_intervencije	INSERT	129	2026-04-13 13:43:42.208896+00
1031	nova_prijava_kvara	servisne_intervencije	INSERT	130	2026-04-13 13:43:42.208896+00
1032	nova_prijava_kvara	servisne_intervencije	INSERT	131	2026-04-13 13:43:42.208896+00
1033	nova_prijava_kvara	servisne_intervencije	INSERT	132	2026-04-13 13:43:42.208896+00
1034	nova_prijava_kvara	servisne_intervencije	INSERT	133	2026-04-13 13:43:42.208896+00
1035	nova_prijava_kvara	servisne_intervencije	INSERT	134	2026-04-13 13:43:42.208896+00
1036	nova_prijava_kvara	servisne_intervencije	INSERT	135	2026-04-13 13:43:42.208896+00
1037	nova_prijava_kvara	servisne_intervencije	INSERT	136	2026-04-13 13:43:42.208896+00
1038	nova_prijava_kvara	servisne_intervencije	INSERT	137	2026-04-13 13:43:42.208896+00
1039	nova_prijava_kvara	servisne_intervencije	INSERT	138	2026-04-13 13:43:42.208896+00
1040	nova_prijava_kvara	servisne_intervencije	INSERT	139	2026-04-13 13:43:42.208896+00
1041	nova_prijava_kvara	servisne_intervencije	INSERT	140	2026-04-13 13:43:42.208896+00
1042	nova_prijava_kvara	servisne_intervencije	INSERT	141	2026-04-13 13:43:42.208896+00
1043	nova_prijava_kvara	servisne_intervencije	INSERT	142	2026-04-13 13:43:42.208896+00
1044	nova_prijava_kvara	servisne_intervencije	INSERT	143	2026-04-13 13:43:42.208896+00
1045	nova_prijava_kvara	servisne_intervencije	INSERT	144	2026-04-13 13:43:42.208896+00
1046	nova_prijava_kvara	servisne_intervencije	INSERT	145	2026-04-13 13:43:42.208896+00
1047	nova_prijava_kvara	servisne_intervencije	INSERT	146	2026-04-13 13:43:42.208896+00
1048	nova_prijava_kvara	servisne_intervencije	INSERT	147	2026-04-13 13:43:42.208896+00
1049	nova_prijava_kvara	servisne_intervencije	INSERT	148	2026-04-13 13:43:42.208896+00
1050	nova_prijava_kvara	servisne_intervencije	INSERT	149	2026-04-13 13:43:42.208896+00
1051	nova_prijava_kvara	servisne_intervencije	INSERT	150	2026-04-13 13:43:42.208896+00
1052	nova_prijava_kvara	servisne_intervencije	INSERT	151	2026-04-13 13:43:42.208896+00
1053	nova_prijava_kvara	servisne_intervencije	INSERT	152	2026-04-13 13:43:42.208896+00
1054	nova_prijava_kvara	servisne_intervencije	INSERT	153	2026-04-13 13:43:42.208896+00
1055	nova_prijava_kvara	servisne_intervencije	INSERT	154	2026-04-13 13:43:42.208896+00
1056	nova_prijava_kvara	servisne_intervencije	INSERT	155	2026-04-13 13:43:42.208896+00
1057	nova_prijava_kvara	servisne_intervencije	INSERT	156	2026-04-13 13:43:42.208896+00
1058	nova_prijava_kvara	servisne_intervencije	INSERT	157	2026-04-13 13:43:42.208896+00
1059	nova_prijava_kvara	servisne_intervencije	INSERT	158	2026-04-13 13:43:42.208896+00
1060	nova_prijava_kvara	servisne_intervencije	INSERT	159	2026-04-13 13:43:42.208896+00
1061	nova_prijava_kvara	servisne_intervencije	INSERT	160	2026-04-13 13:43:42.208896+00
1062	nova_prijava_kvara	servisne_intervencije	INSERT	161	2026-04-13 13:43:42.208896+00
1063	nova_prijava_kvara	servisne_intervencije	INSERT	162	2026-04-13 13:43:42.208896+00
1064	nova_prijava_kvara	servisne_intervencije	INSERT	163	2026-04-13 13:43:42.208896+00
1065	nova_prijava_kvara	servisne_intervencije	INSERT	164	2026-04-13 13:43:42.208896+00
1066	nova_prijava_kvara	servisne_intervencije	INSERT	165	2026-04-13 13:43:42.208896+00
1067	nova_prijava_kvara	servisne_intervencije	INSERT	166	2026-04-13 13:43:42.208896+00
1068	nova_prijava_kvara	servisne_intervencije	INSERT	167	2026-04-13 13:43:42.208896+00
1069	nova_prijava_kvara	servisne_intervencije	INSERT	168	2026-04-13 13:43:42.208896+00
1070	nova_prijava_kvara	servisne_intervencije	INSERT	169	2026-04-13 13:43:42.208896+00
1071	nova_prijava_kvara	servisne_intervencije	INSERT	170	2026-04-13 13:43:42.208896+00
1072	nova_prijava_kvara	servisne_intervencije	INSERT	171	2026-04-13 13:43:42.208896+00
1073	nova_prijava_kvara	servisne_intervencije	INSERT	172	2026-04-13 13:43:42.208896+00
1074	nova_prijava_kvara	servisne_intervencije	INSERT	173	2026-04-13 13:43:42.208896+00
1075	nova_prijava_kvara	servisne_intervencije	INSERT	174	2026-04-13 13:43:42.208896+00
1076	nova_prijava_kvara	servisne_intervencije	INSERT	175	2026-04-13 13:43:42.208896+00
1077	nova_prijava_kvara	servisne_intervencije	INSERT	176	2026-04-13 13:43:42.208896+00
1078	nova_prijava_kvara	servisne_intervencije	INSERT	177	2026-04-13 13:43:42.208896+00
1079	nova_prijava_kvara	servisne_intervencije	INSERT	178	2026-04-13 13:43:42.208896+00
1080	nova_prijava_kvara	servisne_intervencije	INSERT	179	2026-04-13 13:43:42.208896+00
1081	nova_prijava_kvara	servisne_intervencije	INSERT	180	2026-04-13 13:43:42.208896+00
1082	nova_prijava_kvara	servisne_intervencije	INSERT	181	2026-04-13 13:43:42.208896+00
1083	nova_prijava_kvara	servisne_intervencije	INSERT	182	2026-04-13 13:43:42.208896+00
1084	nova_prijava_kvara	servisne_intervencije	INSERT	183	2026-04-13 13:43:42.208896+00
1085	nova_prijava_kvara	servisne_intervencije	INSERT	184	2026-04-13 13:43:42.208896+00
1086	nova_prijava_kvara	servisne_intervencije	INSERT	185	2026-04-13 13:43:42.208896+00
1087	nova_prijava_kvara	servisne_intervencije	INSERT	186	2026-04-13 13:43:42.208896+00
1088	nova_prijava_kvara	servisne_intervencije	INSERT	187	2026-04-13 13:43:42.208896+00
1089	nova_prijava_kvara	servisne_intervencije	INSERT	188	2026-04-13 13:43:42.208896+00
1090	nova_prijava_kvara	servisne_intervencije	INSERT	189	2026-04-13 13:43:42.208896+00
1091	nova_prijava_kvara	servisne_intervencije	INSERT	190	2026-04-13 13:43:42.208896+00
1092	nova_prijava_kvara	servisne_intervencije	INSERT	191	2026-04-13 13:43:42.208896+00
1093	nova_prijava_kvara	servisne_intervencije	INSERT	192	2026-04-13 13:43:42.208896+00
1094	nova_prijava_kvara	servisne_intervencije	INSERT	193	2026-04-13 13:43:42.208896+00
1095	nova_prijava_kvara	servisne_intervencije	INSERT	194	2026-04-13 13:43:42.208896+00
1096	nova_prijava_kvara	servisne_intervencije	INSERT	195	2026-04-13 13:43:42.208896+00
1097	nova_prijava_kvara	servisne_intervencije	INSERT	196	2026-04-13 13:43:42.208896+00
1098	nova_prijava_kvara	servisne_intervencije	INSERT	197	2026-04-13 13:43:42.208896+00
1099	nova_prijava_kvara	servisne_intervencije	INSERT	198	2026-04-13 13:43:42.208896+00
1100	nova_prijava_kvara	servisne_intervencije	INSERT	199	2026-04-13 13:43:42.208896+00
1101	nova_prijava_kvara	servisne_intervencije	INSERT	200	2026-04-13 13:43:42.208896+00
1102	nova_prijava_kvara	servisne_intervencije	INSERT	201	2026-04-13 13:43:42.208896+00
1103	nova_prijava_kvara	servisne_intervencije	INSERT	202	2026-04-13 13:43:42.208896+00
1104	nova_prijava_kvara	servisne_intervencije	INSERT	203	2026-04-13 13:43:42.208896+00
1105	nova_prijava_kvara	servisne_intervencije	INSERT	204	2026-04-13 13:43:42.208896+00
1106	nova_prijava_kvara	servisne_intervencije	INSERT	205	2026-04-13 13:43:42.208896+00
1107	nova_prijava_kvara	servisne_intervencije	INSERT	206	2026-04-13 13:43:42.208896+00
1108	nova_prijava_kvara	servisne_intervencije	INSERT	207	2026-04-13 13:43:42.208896+00
1109	nova_prijava_kvara	servisne_intervencije	INSERT	208	2026-04-13 13:43:42.208896+00
1110	nova_prijava_kvara	servisne_intervencije	INSERT	209	2026-04-13 13:43:42.208896+00
1111	nova_prijava_kvara	servisne_intervencije	INSERT	210	2026-04-13 13:43:42.208896+00
1112	nova_prijava_kvara	servisne_intervencije	INSERT	211	2026-04-13 13:43:42.208896+00
1113	nova_prijava_kvara	servisne_intervencije	INSERT	212	2026-04-13 13:43:42.208896+00
1114	nova_prijava_kvara	servisne_intervencije	INSERT	213	2026-04-13 13:43:42.208896+00
1115	nova_prijava_kvara	servisne_intervencije	INSERT	214	2026-04-13 13:43:42.208896+00
1116	nova_prijava_kvara	servisne_intervencije	INSERT	215	2026-04-13 13:43:42.208896+00
1117	nova_prijava_kvara	servisne_intervencije	INSERT	216	2026-04-13 13:43:42.208896+00
1118	nova_prijava_kvara	servisne_intervencije	INSERT	217	2026-04-13 13:43:42.208896+00
1119	nova_prijava_kvara	servisne_intervencije	INSERT	218	2026-04-13 13:43:42.208896+00
1120	nova_prijava_kvara	servisne_intervencije	INSERT	219	2026-04-13 13:43:42.208896+00
1121	nova_prijava_kvara	servisne_intervencije	INSERT	220	2026-04-13 13:43:42.208896+00
1122	nova_prijava_kvara	servisne_intervencije	INSERT	221	2026-04-13 13:43:42.208896+00
1123	nova_prijava_kvara	servisne_intervencije	INSERT	222	2026-04-13 13:43:42.208896+00
1124	nova_prijava_kvara	servisne_intervencije	INSERT	223	2026-04-13 13:43:42.208896+00
1125	nova_prijava_kvara	servisne_intervencije	INSERT	224	2026-04-13 13:43:42.208896+00
1126	nova_prijava_kvara	servisne_intervencije	INSERT	225	2026-04-13 13:43:42.208896+00
1127	nova_prijava_kvara	servisne_intervencije	INSERT	226	2026-04-13 13:43:42.208896+00
1128	nova_prijava_kvara	servisne_intervencije	INSERT	227	2026-04-13 13:43:42.208896+00
1129	nova_prijava_kvara	servisne_intervencije	INSERT	228	2026-04-13 13:43:42.208896+00
1130	nova_prijava_kvara	servisne_intervencije	INSERT	229	2026-04-13 13:43:42.208896+00
1131	nova_prijava_kvara	servisne_intervencije	INSERT	230	2026-04-13 13:43:42.208896+00
1132	nova_prijava_kvara	servisne_intervencije	INSERT	231	2026-04-13 13:43:42.208896+00
1133	nova_prijava_kvara	servisne_intervencije	INSERT	232	2026-04-13 13:43:42.208896+00
1134	nova_prijava_kvara	servisne_intervencije	INSERT	233	2026-04-13 13:43:42.208896+00
1135	nova_prijava_kvara	servisne_intervencije	INSERT	234	2026-04-13 13:43:42.208896+00
1136	nova_prijava_kvara	servisne_intervencije	INSERT	235	2026-04-13 13:43:42.208896+00
1137	nova_prijava_kvara	servisne_intervencije	INSERT	236	2026-04-13 13:43:42.208896+00
1138	nova_prijava_kvara	servisne_intervencije	INSERT	237	2026-04-13 13:43:42.208896+00
1139	nova_prijava_kvara	servisne_intervencije	INSERT	238	2026-04-13 13:43:42.208896+00
1140	nova_prijava_kvara	servisne_intervencije	INSERT	239	2026-04-13 13:43:42.208896+00
1141	nova_prijava_kvara	servisne_intervencije	INSERT	240	2026-04-13 13:43:42.208896+00
1142	nova_prijava_kvara	servisne_intervencije	INSERT	241	2026-04-13 13:43:42.208896+00
1143	nova_prijava_kvara	servisne_intervencije	INSERT	242	2026-04-13 13:43:42.208896+00
1144	nova_prijava_kvara	servisne_intervencije	INSERT	243	2026-04-13 13:43:42.208896+00
1145	nova_prijava_kvara	servisne_intervencije	INSERT	244	2026-04-13 13:43:42.208896+00
1146	nova_prijava_kvara	servisne_intervencije	INSERT	245	2026-04-13 13:43:42.208896+00
1147	nova_prijava_kvara	servisne_intervencije	INSERT	246	2026-04-13 13:43:42.208896+00
1148	nova_prijava_kvara	servisne_intervencije	INSERT	247	2026-04-13 13:43:42.208896+00
1149	nova_prijava_kvara	servisne_intervencije	INSERT	248	2026-04-13 13:43:42.208896+00
1150	nova_prijava_kvara	servisne_intervencije	INSERT	249	2026-04-13 13:43:42.208896+00
1151	nova_prijava_kvara	servisne_intervencije	INSERT	250	2026-04-13 13:43:42.208896+00
1152	nova_prijava_kvara	servisne_intervencije	INSERT	251	2026-04-13 13:43:42.208896+00
1153	nova_prijava_kvara	servisne_intervencije	INSERT	252	2026-04-13 13:43:42.208896+00
1154	nova_prijava_kvara	servisne_intervencije	INSERT	253	2026-04-13 13:43:42.208896+00
1155	nova_prijava_kvara	servisne_intervencije	INSERT	254	2026-04-13 13:43:42.208896+00
1156	nova_prijava_kvara	servisne_intervencije	INSERT	255	2026-04-13 13:43:42.208896+00
1157	nova_prijava_kvara	servisne_intervencije	INSERT	256	2026-04-13 13:43:42.208896+00
1158	nova_prijava_kvara	servisne_intervencije	INSERT	257	2026-04-13 13:43:42.208896+00
1159	nova_prijava_kvara	servisne_intervencije	INSERT	258	2026-04-13 13:43:42.208896+00
1160	nova_prijava_kvara	servisne_intervencije	INSERT	259	2026-04-13 13:43:42.208896+00
1161	nova_prijava_kvara	servisne_intervencije	INSERT	260	2026-04-13 13:43:42.208896+00
1162	nova_prijava_kvara	servisne_intervencije	INSERT	261	2026-04-13 13:43:42.208896+00
1163	nova_prijava_kvara	servisne_intervencije	INSERT	262	2026-04-13 13:43:42.208896+00
1164	nova_prijava_kvara	servisne_intervencije	INSERT	263	2026-04-13 13:43:42.208896+00
1165	nova_prijava_kvara	servisne_intervencije	INSERT	264	2026-04-13 13:43:42.208896+00
1166	nova_prijava_kvara	servisne_intervencije	INSERT	265	2026-04-13 13:43:42.208896+00
1167	nova_prijava_kvara	servisne_intervencije	INSERT	266	2026-04-13 13:43:42.208896+00
1168	nova_prijava_kvara	servisne_intervencije	INSERT	267	2026-04-13 13:43:42.208896+00
1169	nova_prijava_kvara	servisne_intervencije	INSERT	268	2026-04-13 13:43:42.208896+00
1170	nova_prijava_kvara	servisne_intervencije	INSERT	269	2026-04-13 13:43:42.208896+00
1171	nova_prijava_kvara	servisne_intervencije	INSERT	270	2026-04-13 13:43:42.208896+00
1172	nova_prijava_kvara	servisne_intervencije	INSERT	271	2026-04-13 13:43:42.208896+00
1173	nova_prijava_kvara	servisne_intervencije	INSERT	272	2026-04-13 13:43:42.208896+00
1174	nova_prijava_kvara	servisne_intervencije	INSERT	273	2026-04-13 13:43:42.208896+00
1175	nova_prijava_kvara	servisne_intervencije	INSERT	274	2026-04-13 13:43:42.208896+00
1176	nova_prijava_kvara	servisne_intervencije	INSERT	275	2026-04-13 13:43:42.208896+00
1177	nova_prijava_kvara	servisne_intervencije	INSERT	276	2026-04-13 13:43:42.208896+00
1178	nova_prijava_kvara	servisne_intervencije	INSERT	277	2026-04-13 13:43:42.208896+00
1179	nova_prijava_kvara	servisne_intervencije	INSERT	278	2026-04-13 13:43:42.208896+00
1180	nova_prijava_kvara	servisne_intervencije	INSERT	279	2026-04-13 13:43:42.208896+00
1181	nova_prijava_kvara	servisne_intervencije	INSERT	280	2026-04-13 13:43:42.208896+00
1182	nova_prijava_kvara	servisne_intervencije	INSERT	281	2026-04-13 13:43:42.208896+00
1183	nova_prijava_kvara	servisne_intervencije	INSERT	282	2026-04-13 13:43:42.208896+00
1184	nova_prijava_kvara	servisne_intervencije	INSERT	283	2026-04-13 13:43:42.208896+00
1185	nova_prijava_kvara	servisne_intervencije	INSERT	284	2026-04-13 13:43:42.208896+00
1186	nova_prijava_kvara	servisne_intervencije	INSERT	285	2026-04-13 13:43:42.208896+00
1187	nova_prijava_kvara	servisne_intervencije	INSERT	286	2026-04-13 13:43:42.208896+00
1188	nova_prijava_kvara	servisne_intervencije	INSERT	287	2026-04-13 13:43:42.208896+00
1189	nova_prijava_kvara	servisne_intervencije	INSERT	288	2026-04-13 13:43:42.208896+00
1190	nova_prijava_kvara	servisne_intervencije	INSERT	289	2026-04-13 13:43:42.208896+00
1191	nova_prijava_kvara	servisne_intervencije	INSERT	290	2026-04-13 13:43:42.208896+00
1192	nova_prijava_kvara	servisne_intervencije	INSERT	291	2026-04-13 13:43:42.208896+00
1193	nova_prijava_kvara	servisne_intervencije	INSERT	292	2026-04-13 13:43:42.208896+00
1194	nova_prijava_kvara	servisne_intervencije	INSERT	293	2026-04-13 13:43:42.208896+00
1195	nova_prijava_kvara	servisne_intervencije	INSERT	294	2026-04-13 13:43:42.208896+00
1196	nova_prijava_kvara	servisne_intervencije	INSERT	295	2026-04-13 13:43:42.208896+00
1197	nova_prijava_kvara	servisne_intervencije	INSERT	296	2026-04-13 13:43:42.208896+00
1198	nova_prijava_kvara	servisne_intervencije	INSERT	297	2026-04-13 13:43:42.208896+00
1199	nova_prijava_kvara	servisne_intervencije	INSERT	298	2026-04-13 13:43:42.208896+00
1200	nova_prijava_kvara	servisne_intervencije	INSERT	299	2026-04-13 13:43:42.208896+00
1201	nova_prijava_kvara	servisne_intervencije	INSERT	300	2026-04-13 13:43:42.208896+00
1202	nova_prijava_kvara	servisne_intervencije	INSERT	301	2026-04-13 13:43:42.208896+00
1203	nova_prijava_kvara	servisne_intervencije	INSERT	302	2026-04-13 13:43:42.208896+00
1204	nova_prijava_kvara	servisne_intervencije	INSERT	303	2026-04-13 13:43:42.208896+00
1205	nova_prijava_kvara	servisne_intervencije	INSERT	304	2026-04-13 13:43:42.208896+00
1206	nova_prijava_kvara	servisne_intervencije	INSERT	305	2026-04-13 13:43:42.208896+00
1207	nova_prijava_kvara	servisne_intervencije	INSERT	306	2026-04-13 13:43:42.208896+00
1208	nova_prijava_kvara	servisne_intervencije	INSERT	307	2026-04-13 13:43:42.208896+00
1209	nova_prijava_kvara	servisne_intervencije	INSERT	308	2026-04-13 13:43:42.208896+00
1210	nova_prijava_kvara	servisne_intervencije	INSERT	309	2026-04-13 13:43:42.208896+00
1211	nova_prijava_kvara	servisne_intervencije	INSERT	310	2026-04-13 13:43:42.208896+00
1212	nova_prijava_kvara	servisne_intervencije	INSERT	311	2026-04-13 13:43:42.208896+00
1213	nova_prijava_kvara	servisne_intervencije	INSERT	312	2026-04-13 13:43:42.208896+00
1214	nova_prijava_kvara	servisne_intervencije	INSERT	313	2026-04-13 13:43:42.208896+00
1215	nova_prijava_kvara	servisne_intervencije	INSERT	314	2026-04-13 13:43:42.208896+00
1216	nova_prijava_kvara	servisne_intervencije	INSERT	315	2026-04-13 13:43:42.208896+00
1217	nova_prijava_kvara	servisne_intervencije	INSERT	316	2026-04-13 13:43:42.208896+00
1218	nova_prijava_kvara	servisne_intervencije	INSERT	317	2026-04-13 13:43:42.208896+00
1219	nova_prijava_kvara	servisne_intervencije	INSERT	318	2026-04-13 13:43:42.208896+00
1220	nova_prijava_kvara	servisne_intervencije	INSERT	319	2026-04-13 13:43:42.208896+00
1221	nova_prijava_kvara	servisne_intervencije	INSERT	320	2026-04-13 13:43:42.208896+00
1222	nova_prijava_kvara	servisne_intervencije	INSERT	321	2026-04-13 13:43:42.208896+00
1223	nova_prijava_kvara	servisne_intervencije	INSERT	322	2026-04-13 13:43:42.208896+00
1224	nova_prijava_kvara	servisne_intervencije	INSERT	323	2026-04-13 13:43:42.208896+00
1225	nova_prijava_kvara	servisne_intervencije	INSERT	324	2026-04-13 13:43:42.208896+00
1226	nova_prijava_kvara	servisne_intervencije	INSERT	325	2026-04-13 13:43:42.208896+00
1227	nova_prijava_kvara	servisne_intervencije	INSERT	326	2026-04-13 13:43:42.208896+00
1228	nova_prijava_kvara	servisne_intervencije	INSERT	327	2026-04-13 13:43:42.208896+00
1229	nova_prijava_kvara	servisne_intervencije	INSERT	328	2026-04-13 13:43:42.208896+00
1230	nova_prijava_kvara	servisne_intervencije	INSERT	329	2026-04-13 13:43:42.208896+00
1231	nova_prijava_kvara	servisne_intervencije	INSERT	330	2026-04-13 13:43:42.208896+00
1232	nova_prijava_kvara	servisne_intervencije	INSERT	331	2026-04-13 13:43:42.208896+00
1233	nova_prijava_kvara	servisne_intervencije	INSERT	332	2026-04-13 13:43:42.208896+00
1234	nova_prijava_kvara	servisne_intervencije	INSERT	333	2026-04-13 13:43:42.208896+00
1235	nova_prijava_kvara	servisne_intervencije	INSERT	334	2026-04-13 13:43:42.208896+00
1236	nova_prijava_kvara	servisne_intervencije	INSERT	335	2026-04-13 13:43:42.208896+00
1237	nova_prijava_kvara	servisne_intervencije	INSERT	336	2026-04-13 13:43:42.208896+00
1238	nova_prijava_kvara	servisne_intervencije	INSERT	337	2026-04-13 13:43:42.208896+00
1239	nova_prijava_kvara	servisne_intervencije	INSERT	338	2026-04-13 13:43:42.208896+00
1240	nova_prijava_kvara	servisne_intervencije	INSERT	339	2026-04-13 13:43:42.208896+00
1241	nova_prijava_kvara	servisne_intervencije	INSERT	340	2026-04-13 13:43:42.208896+00
1242	nova_prijava_kvara	servisne_intervencije	INSERT	341	2026-04-13 13:43:42.208896+00
1243	nova_prijava_kvara	servisne_intervencije	INSERT	342	2026-04-13 13:43:42.208896+00
1244	nova_prijava_kvara	servisne_intervencije	INSERT	343	2026-04-13 13:43:42.208896+00
1245	nova_prijava_kvara	servisne_intervencije	INSERT	344	2026-04-13 13:43:42.208896+00
1246	nova_prijava_kvara	servisne_intervencije	INSERT	345	2026-04-13 13:43:42.208896+00
1247	nova_prijava_kvara	servisne_intervencije	INSERT	346	2026-04-13 13:43:42.208896+00
1248	nova_prijava_kvara	servisne_intervencije	INSERT	347	2026-04-13 13:43:42.208896+00
1249	nova_prijava_kvara	servisne_intervencije	INSERT	348	2026-04-13 13:43:42.208896+00
1250	nova_prijava_kvara	servisne_intervencije	INSERT	349	2026-04-13 13:43:42.208896+00
1251	nova_prijava_kvara	servisne_intervencije	INSERT	350	2026-04-13 13:43:42.208896+00
1252	nova_prijava_kvara	servisne_intervencije	INSERT	351	2026-04-13 13:43:42.208896+00
1253	nova_prijava_kvara	servisne_intervencije	INSERT	352	2026-04-13 13:43:42.208896+00
1254	nova_prijava_kvara	servisne_intervencije	INSERT	353	2026-04-13 13:43:42.208896+00
1255	nova_prijava_kvara	servisne_intervencije	INSERT	354	2026-04-13 13:43:42.208896+00
1256	nova_prijava_kvara	servisne_intervencije	INSERT	355	2026-04-13 13:43:42.208896+00
1257	nova_prijava_kvara	servisne_intervencije	INSERT	356	2026-04-13 13:43:42.208896+00
1258	nova_prijava_kvara	servisne_intervencije	INSERT	357	2026-04-13 13:43:42.208896+00
1259	nova_prijava_kvara	servisne_intervencije	INSERT	358	2026-04-13 13:43:42.208896+00
1260	nova_prijava_kvara	servisne_intervencije	INSERT	359	2026-04-13 13:43:42.208896+00
1261	nova_prijava_kvara	servisne_intervencije	INSERT	360	2026-04-13 13:43:42.208896+00
1262	nova_prijava_kvara	servisne_intervencije	INSERT	361	2026-04-13 13:43:42.208896+00
1263	nova_prijava_kvara	servisne_intervencije	INSERT	362	2026-04-13 13:43:42.208896+00
1264	nova_prijava_kvara	servisne_intervencije	INSERT	363	2026-04-13 13:43:42.208896+00
1265	nova_prijava_kvara	servisne_intervencije	INSERT	364	2026-04-13 13:43:42.208896+00
1266	nova_prijava_kvara	servisne_intervencije	INSERT	365	2026-04-13 13:43:42.208896+00
1267	nova_prijava_kvara	servisne_intervencije	INSERT	366	2026-04-13 13:43:42.208896+00
1268	nova_prijava_kvara	servisne_intervencije	INSERT	367	2026-04-13 13:43:42.208896+00
1269	nova_prijava_kvara	servisne_intervencije	INSERT	368	2026-04-13 13:43:42.208896+00
1270	nova_prijava_kvara	servisne_intervencije	INSERT	369	2026-04-13 13:43:42.208896+00
1271	nova_prijava_kvara	servisne_intervencije	INSERT	370	2026-04-13 13:43:42.208896+00
1272	nova_prijava_kvara	servisne_intervencije	INSERT	371	2026-04-13 13:43:42.208896+00
1273	nova_prijava_kvara	servisne_intervencije	INSERT	372	2026-04-13 13:43:42.208896+00
1274	nova_prijava_kvara	servisne_intervencije	INSERT	373	2026-04-13 13:43:42.208896+00
1275	nova_prijava_kvara	servisne_intervencije	INSERT	374	2026-04-13 13:43:42.208896+00
1276	nova_prijava_kvara	servisne_intervencije	INSERT	375	2026-04-13 13:43:42.208896+00
1277	nova_prijava_kvara	servisne_intervencije	INSERT	376	2026-04-13 13:43:42.208896+00
1278	nova_prijava_kvara	servisne_intervencije	INSERT	377	2026-04-13 13:43:42.208896+00
1279	nova_prijava_kvara	servisne_intervencije	INSERT	378	2026-04-13 13:43:42.208896+00
1280	nova_prijava_kvara	servisne_intervencije	INSERT	379	2026-04-13 13:43:42.208896+00
1281	nova_prijava_kvara	servisne_intervencije	INSERT	380	2026-04-13 13:43:42.208896+00
1282	nova_prijava_kvara	servisne_intervencije	INSERT	381	2026-04-13 13:43:42.208896+00
1283	nova_prijava_kvara	servisne_intervencije	INSERT	382	2026-04-13 13:43:42.208896+00
1284	nova_prijava_kvara	servisne_intervencije	INSERT	383	2026-04-13 13:43:42.208896+00
1285	nova_prijava_kvara	servisne_intervencije	INSERT	384	2026-04-13 13:43:42.208896+00
1286	nova_prijava_kvara	servisne_intervencije	INSERT	385	2026-04-13 13:43:42.208896+00
1287	nova_prijava_kvara	servisne_intervencije	INSERT	386	2026-04-13 13:43:42.208896+00
1288	nova_prijava_kvara	servisne_intervencije	INSERT	387	2026-04-13 13:43:42.208896+00
1289	nova_prijava_kvara	servisne_intervencije	INSERT	388	2026-04-13 13:43:42.208896+00
1290	nova_prijava_kvara	servisne_intervencije	INSERT	389	2026-04-13 13:43:42.208896+00
1291	nova_prijava_kvara	servisne_intervencije	INSERT	390	2026-04-13 13:43:42.208896+00
1292	nova_prijava_kvara	servisne_intervencije	INSERT	391	2026-04-13 13:43:42.208896+00
1293	nova_prijava_kvara	servisne_intervencije	INSERT	392	2026-04-13 13:43:42.208896+00
1294	nova_prijava_kvara	servisne_intervencije	INSERT	393	2026-04-13 13:43:42.208896+00
1295	nova_prijava_kvara	servisne_intervencije	INSERT	394	2026-04-13 13:43:42.208896+00
1296	nova_prijava_kvara	servisne_intervencije	INSERT	395	2026-04-13 13:43:42.208896+00
1297	nova_prijava_kvara	servisne_intervencije	INSERT	396	2026-04-13 13:43:42.208896+00
1298	nova_prijava_kvara	servisne_intervencije	INSERT	397	2026-04-13 13:43:42.208896+00
1299	nova_prijava_kvara	servisne_intervencije	INSERT	398	2026-04-13 13:43:42.208896+00
1300	nova_prijava_kvara	servisne_intervencije	INSERT	399	2026-04-13 13:43:42.208896+00
1301	nova_prijava_kvara	servisne_intervencije	INSERT	400	2026-04-13 13:43:42.208896+00
1302	nova_prijava_kvara	servisne_intervencije	INSERT	401	2026-04-13 13:43:42.208896+00
1303	nova_prijava_kvara	servisne_intervencije	INSERT	402	2026-04-13 13:43:42.208896+00
1304	nova_prijava_kvara	servisne_intervencije	INSERT	403	2026-04-13 13:43:42.208896+00
1305	nova_prijava_kvara	servisne_intervencije	INSERT	404	2026-04-13 13:43:42.208896+00
1306	nova_prijava_kvara	servisne_intervencije	INSERT	405	2026-04-13 13:43:42.208896+00
1307	nova_prijava_kvara	servisne_intervencije	INSERT	406	2026-04-13 13:43:42.208896+00
1308	nova_prijava_kvara	servisne_intervencije	INSERT	407	2026-04-13 13:43:42.208896+00
1309	nova_prijava_kvara	servisne_intervencije	INSERT	408	2026-04-13 13:43:42.208896+00
1310	nova_prijava_kvara	servisne_intervencije	INSERT	409	2026-04-13 13:43:42.208896+00
1311	nova_prijava_kvara	servisne_intervencije	INSERT	410	2026-04-13 13:43:42.208896+00
1312	nova_prijava_kvara	servisne_intervencije	INSERT	411	2026-04-13 13:43:42.208896+00
1313	nova_prijava_kvara	servisne_intervencije	INSERT	412	2026-04-13 13:43:42.208896+00
1314	nova_prijava_kvara	servisne_intervencije	INSERT	413	2026-04-13 13:43:42.208896+00
1315	nova_prijava_kvara	servisne_intervencije	INSERT	414	2026-04-13 13:43:42.208896+00
1316	nova_prijava_kvara	servisne_intervencije	INSERT	415	2026-04-13 13:43:42.208896+00
1317	nova_prijava_kvara	servisne_intervencije	INSERT	416	2026-04-13 13:43:42.208896+00
1318	nova_prijava_kvara	servisne_intervencije	INSERT	417	2026-04-13 13:43:42.208896+00
1319	nova_prijava_kvara	servisne_intervencije	INSERT	418	2026-04-13 13:43:42.208896+00
1320	nova_prijava_kvara	servisne_intervencije	INSERT	419	2026-04-13 13:43:42.208896+00
1321	nova_prijava_kvara	servisne_intervencije	INSERT	420	2026-04-13 13:43:42.208896+00
1322	nova_prijava_kvara	servisne_intervencije	INSERT	421	2026-04-13 13:43:42.208896+00
1323	nova_prijava_kvara	servisne_intervencije	INSERT	422	2026-04-13 13:43:42.208896+00
1324	nova_prijava_kvara	servisne_intervencije	INSERT	423	2026-04-13 13:43:42.208896+00
1325	nova_prijava_kvara	servisne_intervencije	INSERT	424	2026-04-13 13:43:42.208896+00
1326	nova_prijava_kvara	servisne_intervencije	INSERT	425	2026-04-13 13:43:42.208896+00
1327	nova_prijava_kvara	servisne_intervencije	INSERT	426	2026-04-13 13:43:42.208896+00
1328	nova_prijava_kvara	servisne_intervencije	INSERT	427	2026-04-13 13:43:42.208896+00
1329	nova_prijava_kvara	servisne_intervencije	INSERT	428	2026-04-13 13:43:42.208896+00
1330	nova_prijava_kvara	servisne_intervencije	INSERT	429	2026-04-13 13:43:42.208896+00
1331	nova_prijava_kvara	servisne_intervencije	INSERT	430	2026-04-13 13:43:42.208896+00
1332	nova_prijava_kvara	servisne_intervencije	INSERT	431	2026-04-13 13:43:42.208896+00
1333	nova_prijava_kvara	servisne_intervencije	INSERT	432	2026-04-13 13:43:42.208896+00
1334	nova_prijava_kvara	servisne_intervencije	INSERT	433	2026-04-13 13:43:42.208896+00
1335	nova_prijava_kvara	servisne_intervencije	INSERT	434	2026-04-13 13:43:42.208896+00
1336	nova_prijava_kvara	servisne_intervencije	INSERT	435	2026-04-13 13:43:42.208896+00
1337	nova_prijava_kvara	servisne_intervencije	INSERT	436	2026-04-13 13:43:42.208896+00
1338	nova_prijava_kvara	servisne_intervencije	INSERT	437	2026-04-13 13:43:42.208896+00
1339	nova_prijava_kvara	servisne_intervencije	INSERT	438	2026-04-13 13:43:42.208896+00
1340	nova_prijava_kvara	servisne_intervencije	INSERT	439	2026-04-13 13:43:42.208896+00
1341	nova_prijava_kvara	servisne_intervencije	INSERT	440	2026-04-13 13:43:42.208896+00
1372	unos_goriva	evidencija_goriva	UPDATE	79	2026-04-13 14:06:47.431729+00
1373	unos_goriva	evidencija_goriva	UPDATE	80	2026-04-13 14:06:47.431729+00
1374	unos_goriva	evidencija_goriva	UPDATE	81	2026-04-13 14:06:47.431729+00
1375	unos_goriva	evidencija_goriva	UPDATE	82	2026-04-13 14:06:47.431729+00
1376	unos_goriva	evidencija_goriva	UPDATE	83	2026-04-13 14:06:47.431729+00
1377	unos_goriva	evidencija_goriva	UPDATE	84	2026-04-13 14:06:47.431729+00
1378	unos_goriva	evidencija_goriva	UPDATE	85	2026-04-13 14:06:47.431729+00
1379	unos_goriva	evidencija_goriva	UPDATE	86	2026-04-13 14:06:47.431729+00
1380	unos_goriva	evidencija_goriva	UPDATE	87	2026-04-13 14:06:47.431729+00
1381	unos_goriva	evidencija_goriva	UPDATE	88	2026-04-13 14:06:47.431729+00
1382	unos_goriva	evidencija_goriva	UPDATE	89	2026-04-13 14:06:47.431729+00
1383	unos_goriva	evidencija_goriva	UPDATE	90	2026-04-13 14:06:47.431729+00
1384	unos_goriva	evidencija_goriva	UPDATE	91	2026-04-13 14:06:47.431729+00
1385	unos_goriva	evidencija_goriva	UPDATE	92	2026-04-13 14:06:47.431729+00
1386	unos_goriva	evidencija_goriva	UPDATE	93	2026-04-13 14:06:47.431729+00
1387	unos_goriva	evidencija_goriva	UPDATE	94	2026-04-13 14:06:47.431729+00
1388	unos_goriva	evidencija_goriva	UPDATE	95	2026-04-13 14:06:47.431729+00
1389	unos_goriva	evidencija_goriva	UPDATE	96	2026-04-13 14:06:47.431729+00
1390	unos_goriva	evidencija_goriva	UPDATE	97	2026-04-13 14:06:47.431729+00
1391	unos_goriva	evidencija_goriva	UPDATE	98	2026-04-13 14:06:47.431729+00
1392	unos_goriva	evidencija_goriva	UPDATE	99	2026-04-13 14:06:47.431729+00
1393	unos_goriva	evidencija_goriva	UPDATE	100	2026-04-13 14:06:47.431729+00
1394	unos_goriva	evidencija_goriva	UPDATE	101	2026-04-13 14:06:47.431729+00
1395	unos_goriva	evidencija_goriva	UPDATE	102	2026-04-13 14:06:47.431729+00
1396	unos_goriva	evidencija_goriva	UPDATE	103	2026-04-13 14:06:47.431729+00
1397	unos_goriva	evidencija_goriva	UPDATE	104	2026-04-13 14:06:47.431729+00
1398	unos_goriva	evidencija_goriva	UPDATE	105	2026-04-13 14:06:47.431729+00
1399	unos_goriva	evidencija_goriva	UPDATE	106	2026-04-13 14:06:47.431729+00
1400	unos_goriva	evidencija_goriva	UPDATE	107	2026-04-13 14:06:47.431729+00
1401	unos_goriva	evidencija_goriva	UPDATE	108	2026-04-13 14:06:47.431729+00
1402	unos_goriva	evidencija_goriva	UPDATE	109	2026-04-13 14:06:47.431729+00
1403	unos_goriva	evidencija_goriva	UPDATE	110	2026-04-13 14:06:47.431729+00
1404	unos_goriva	evidencija_goriva	UPDATE	111	2026-04-13 14:06:47.431729+00
1405	unos_goriva	evidencija_goriva	UPDATE	112	2026-04-13 14:06:47.431729+00
1406	unos_goriva	evidencija_goriva	UPDATE	113	2026-04-13 14:06:47.431729+00
1407	unos_goriva	evidencija_goriva	UPDATE	114	2026-04-13 14:06:47.431729+00
1408	unos_goriva	evidencija_goriva	UPDATE	115	2026-04-13 14:06:47.431729+00
1409	unos_goriva	evidencija_goriva	UPDATE	116	2026-04-13 14:06:47.431729+00
1410	unos_goriva	evidencija_goriva	UPDATE	117	2026-04-13 14:06:47.431729+00
1411	unos_goriva	evidencija_goriva	UPDATE	118	2026-04-13 14:06:47.431729+00
1412	unos_goriva	evidencija_goriva	UPDATE	119	2026-04-13 14:06:47.431729+00
1413	unos_goriva	evidencija_goriva	UPDATE	120	2026-04-13 14:06:47.431729+00
1414	unos_goriva	evidencija_goriva	UPDATE	121	2026-04-13 14:06:47.431729+00
1415	unos_goriva	evidencija_goriva	UPDATE	122	2026-04-13 14:06:47.431729+00
1416	unos_goriva	evidencija_goriva	UPDATE	123	2026-04-13 14:06:47.431729+00
1417	unos_goriva	evidencija_goriva	UPDATE	124	2026-04-13 14:06:47.431729+00
1418	unos_goriva	evidencija_goriva	UPDATE	125	2026-04-13 14:06:47.431729+00
1419	unos_goriva	evidencija_goriva	UPDATE	126	2026-04-13 14:06:47.431729+00
1420	unos_goriva	evidencija_goriva	UPDATE	127	2026-04-13 14:06:47.431729+00
1421	unos_goriva	evidencija_goriva	UPDATE	128	2026-04-13 14:06:47.431729+00
1422	unos_goriva	evidencija_goriva	UPDATE	129	2026-04-13 14:06:47.431729+00
1423	unos_goriva	evidencija_goriva	UPDATE	130	2026-04-13 14:06:47.431729+00
1424	unos_goriva	evidencija_goriva	UPDATE	131	2026-04-13 14:06:47.431729+00
1425	unos_goriva	evidencija_goriva	UPDATE	132	2026-04-13 14:06:47.431729+00
1426	unos_goriva	evidencija_goriva	UPDATE	133	2026-04-13 14:06:47.431729+00
1427	unos_goriva	evidencija_goriva	UPDATE	134	2026-04-13 14:06:47.431729+00
1428	unos_goriva	evidencija_goriva	UPDATE	135	2026-04-13 14:06:47.431729+00
1429	unos_goriva	evidencija_goriva	UPDATE	136	2026-04-13 14:06:47.431729+00
1430	unos_goriva	evidencija_goriva	UPDATE	137	2026-04-13 14:06:47.431729+00
1431	unos_goriva	evidencija_goriva	UPDATE	138	2026-04-13 14:06:47.431729+00
1432	unos_goriva	evidencija_goriva	UPDATE	139	2026-04-13 14:06:47.431729+00
1433	unos_goriva	evidencija_goriva	UPDATE	140	2026-04-13 14:06:47.431729+00
1434	unos_goriva	evidencija_goriva	UPDATE	141	2026-04-13 14:06:47.431729+00
1435	unos_goriva	evidencija_goriva	UPDATE	142	2026-04-13 14:06:47.431729+00
1436	unos_goriva	evidencija_goriva	UPDATE	143	2026-04-13 14:06:47.431729+00
1437	unos_goriva	evidencija_goriva	UPDATE	144	2026-04-13 14:06:47.431729+00
1438	unos_goriva	evidencija_goriva	UPDATE	145	2026-04-13 14:06:47.431729+00
1439	unos_goriva	evidencija_goriva	UPDATE	146	2026-04-13 14:06:47.431729+00
1440	unos_goriva	evidencija_goriva	UPDATE	147	2026-04-13 14:06:47.431729+00
1441	unos_goriva	evidencija_goriva	UPDATE	148	2026-04-13 14:06:47.431729+00
1442	unos_goriva	evidencija_goriva	UPDATE	149	2026-04-13 14:06:47.431729+00
1443	unos_goriva	evidencija_goriva	UPDATE	150	2026-04-13 14:06:47.431729+00
1444	unos_goriva	evidencija_goriva	UPDATE	151	2026-04-13 14:06:47.431729+00
1445	unos_goriva	evidencija_goriva	UPDATE	152	2026-04-13 14:06:47.431729+00
1446	unos_goriva	evidencija_goriva	UPDATE	153	2026-04-13 14:06:47.431729+00
1447	unos_goriva	evidencija_goriva	UPDATE	154	2026-04-13 14:06:47.431729+00
1448	unos_goriva	evidencija_goriva	UPDATE	155	2026-04-13 14:06:47.431729+00
1449	unos_goriva	evidencija_goriva	UPDATE	156	2026-04-13 14:06:47.431729+00
1450	unos_goriva	evidencija_goriva	UPDATE	157	2026-04-13 14:06:47.431729+00
1451	unos_goriva	evidencija_goriva	UPDATE	158	2026-04-13 14:06:47.431729+00
1452	unos_goriva	evidencija_goriva	UPDATE	159	2026-04-13 14:06:47.431729+00
1453	unos_goriva	evidencija_goriva	UPDATE	160	2026-04-13 14:06:47.431729+00
1454	unos_goriva	evidencija_goriva	UPDATE	161	2026-04-13 14:06:47.431729+00
1455	unos_goriva	evidencija_goriva	UPDATE	162	2026-04-13 14:06:47.431729+00
1456	unos_goriva	evidencija_goriva	UPDATE	163	2026-04-13 14:06:47.431729+00
1457	unos_goriva	evidencija_goriva	UPDATE	164	2026-04-13 14:06:47.431729+00
1458	unos_goriva	evidencija_goriva	UPDATE	165	2026-04-13 14:06:47.431729+00
1459	unos_goriva	evidencija_goriva	UPDATE	166	2026-04-13 14:06:47.431729+00
1460	unos_goriva	evidencija_goriva	UPDATE	167	2026-04-13 14:06:47.431729+00
1461	unos_goriva	evidencija_goriva	UPDATE	168	2026-04-13 14:06:47.431729+00
1462	unos_goriva	evidencija_goriva	UPDATE	169	2026-04-13 14:06:47.431729+00
1463	unos_goriva	evidencija_goriva	UPDATE	170	2026-04-13 14:06:47.431729+00
1464	unos_goriva	evidencija_goriva	UPDATE	171	2026-04-13 14:06:47.431729+00
1465	unos_goriva	evidencija_goriva	UPDATE	172	2026-04-13 14:06:47.431729+00
1466	unos_goriva	evidencija_goriva	UPDATE	173	2026-04-13 14:06:47.431729+00
1467	unos_goriva	evidencija_goriva	UPDATE	174	2026-04-13 14:06:47.431729+00
1468	unos_goriva	evidencija_goriva	UPDATE	175	2026-04-13 14:06:47.431729+00
1469	unos_goriva	evidencija_goriva	UPDATE	176	2026-04-13 14:06:47.431729+00
1470	unos_goriva	evidencija_goriva	UPDATE	177	2026-04-13 14:06:47.431729+00
1471	unos_goriva	evidencija_goriva	UPDATE	178	2026-04-13 14:06:47.431729+00
1472	unos_goriva	evidencija_goriva	UPDATE	179	2026-04-13 14:06:47.431729+00
1473	unos_goriva	evidencija_goriva	UPDATE	180	2026-04-13 14:06:47.431729+00
1474	unos_goriva	evidencija_goriva	UPDATE	181	2026-04-13 14:06:47.431729+00
1475	unos_goriva	evidencija_goriva	UPDATE	182	2026-04-13 14:06:47.431729+00
1476	unos_goriva	evidencija_goriva	UPDATE	183	2026-04-13 14:06:47.431729+00
1477	unos_goriva	evidencija_goriva	UPDATE	184	2026-04-13 14:06:47.431729+00
1478	unos_goriva	evidencija_goriva	UPDATE	185	2026-04-13 14:06:47.431729+00
1479	unos_goriva	evidencija_goriva	UPDATE	186	2026-04-13 14:06:47.431729+00
1480	unos_goriva	evidencija_goriva	UPDATE	187	2026-04-13 14:06:47.431729+00
1481	unos_goriva	evidencija_goriva	UPDATE	188	2026-04-13 14:06:47.431729+00
1482	unos_goriva	evidencija_goriva	UPDATE	189	2026-04-13 14:06:47.431729+00
1483	unos_goriva	evidencija_goriva	UPDATE	190	2026-04-13 14:06:47.431729+00
1484	unos_goriva	evidencija_goriva	UPDATE	191	2026-04-13 14:06:47.431729+00
1485	unos_goriva	evidencija_goriva	UPDATE	192	2026-04-13 14:06:47.431729+00
1486	unos_goriva	evidencija_goriva	UPDATE	193	2026-04-13 14:06:47.431729+00
1487	unos_goriva	evidencija_goriva	UPDATE	194	2026-04-13 14:06:47.431729+00
1488	unos_goriva	evidencija_goriva	UPDATE	195	2026-04-13 14:06:47.431729+00
1489	unos_goriva	evidencija_goriva	UPDATE	196	2026-04-13 14:06:47.431729+00
1490	unos_goriva	evidencija_goriva	UPDATE	197	2026-04-13 14:06:47.431729+00
1491	unos_goriva	evidencija_goriva	UPDATE	198	2026-04-13 14:06:47.431729+00
1492	unos_goriva	evidencija_goriva	UPDATE	199	2026-04-13 14:06:47.431729+00
1493	unos_goriva	evidencija_goriva	UPDATE	200	2026-04-13 14:06:47.431729+00
1494	unos_goriva	evidencija_goriva	UPDATE	201	2026-04-13 14:06:47.431729+00
1495	unos_goriva	evidencija_goriva	UPDATE	202	2026-04-13 14:06:47.431729+00
1496	unos_goriva	evidencija_goriva	UPDATE	203	2026-04-13 14:06:47.431729+00
1497	unos_goriva	evidencija_goriva	UPDATE	204	2026-04-13 14:06:47.431729+00
1498	unos_goriva	evidencija_goriva	UPDATE	205	2026-04-13 14:06:47.431729+00
1499	unos_goriva	evidencija_goriva	UPDATE	206	2026-04-13 14:06:47.431729+00
1500	unos_goriva	evidencija_goriva	UPDATE	207	2026-04-13 14:06:47.431729+00
1501	unos_goriva	evidencija_goriva	UPDATE	208	2026-04-13 14:06:47.431729+00
1502	unos_goriva	evidencija_goriva	UPDATE	209	2026-04-13 14:06:47.431729+00
1503	unos_goriva	evidencija_goriva	UPDATE	210	2026-04-13 14:06:47.431729+00
1504	unos_goriva	evidencija_goriva	UPDATE	211	2026-04-13 14:06:47.431729+00
1505	unos_goriva	evidencija_goriva	UPDATE	212	2026-04-13 14:06:47.431729+00
1506	unos_goriva	evidencija_goriva	UPDATE	213	2026-04-13 14:06:47.431729+00
1507	unos_goriva	evidencija_goriva	UPDATE	214	2026-04-13 14:06:47.431729+00
1508	unos_goriva	evidencija_goriva	UPDATE	215	2026-04-13 14:06:47.431729+00
1509	unos_goriva	evidencija_goriva	UPDATE	216	2026-04-13 14:06:47.431729+00
1510	unos_goriva	evidencija_goriva	UPDATE	217	2026-04-13 14:06:47.431729+00
1511	unos_goriva	evidencija_goriva	UPDATE	218	2026-04-13 14:06:47.431729+00
1512	unos_goriva	evidencija_goriva	UPDATE	219	2026-04-13 14:06:47.431729+00
1513	unos_goriva	evidencija_goriva	UPDATE	220	2026-04-13 14:06:47.431729+00
1514	unos_goriva	evidencija_goriva	UPDATE	221	2026-04-13 14:06:47.431729+00
1515	unos_goriva	evidencija_goriva	UPDATE	222	2026-04-13 14:06:47.431729+00
1516	unos_goriva	evidencija_goriva	UPDATE	223	2026-04-13 14:06:47.431729+00
1517	unos_goriva	evidencija_goriva	UPDATE	224	2026-04-13 14:06:47.431729+00
1518	unos_goriva	evidencija_goriva	UPDATE	225	2026-04-13 14:06:47.431729+00
1519	unos_goriva	evidencija_goriva	UPDATE	226	2026-04-13 14:06:47.431729+00
1520	unos_goriva	evidencija_goriva	UPDATE	227	2026-04-13 14:06:47.431729+00
1521	unos_goriva	evidencija_goriva	UPDATE	228	2026-04-13 14:06:47.431729+00
1522	unos_goriva	evidencija_goriva	UPDATE	229	2026-04-13 14:06:47.431729+00
1523	unos_goriva	evidencija_goriva	UPDATE	230	2026-04-13 14:06:47.431729+00
1524	unos_goriva	evidencija_goriva	UPDATE	231	2026-04-13 14:06:47.431729+00
1525	unos_goriva	evidencija_goriva	UPDATE	232	2026-04-13 14:06:47.431729+00
1526	unos_goriva	evidencija_goriva	UPDATE	233	2026-04-13 14:06:47.431729+00
1527	unos_goriva	evidencija_goriva	UPDATE	234	2026-04-13 14:06:47.431729+00
1528	unos_goriva	evidencija_goriva	UPDATE	235	2026-04-13 14:06:47.431729+00
1529	unos_goriva	evidencija_goriva	UPDATE	236	2026-04-13 14:06:47.431729+00
1530	unos_goriva	evidencija_goriva	UPDATE	237	2026-04-13 14:06:47.431729+00
1531	unos_goriva	evidencija_goriva	UPDATE	238	2026-04-13 14:06:47.431729+00
1532	unos_goriva	evidencija_goriva	UPDATE	239	2026-04-13 14:06:47.431729+00
1533	unos_goriva	evidencija_goriva	UPDATE	240	2026-04-13 14:06:47.431729+00
1534	unos_goriva	evidencija_goriva	UPDATE	241	2026-04-13 14:06:47.431729+00
1535	unos_goriva	evidencija_goriva	UPDATE	242	2026-04-13 14:06:47.431729+00
1536	unos_goriva	evidencija_goriva	UPDATE	243	2026-04-13 14:06:47.431729+00
1537	unos_goriva	evidencija_goriva	UPDATE	244	2026-04-13 14:06:47.431729+00
1538	unos_goriva	evidencija_goriva	UPDATE	245	2026-04-13 14:06:47.431729+00
1539	unos_goriva	evidencija_goriva	UPDATE	246	2026-04-13 14:06:47.431729+00
1540	unos_goriva	evidencija_goriva	UPDATE	247	2026-04-13 14:06:47.431729+00
1541	unos_goriva	evidencija_goriva	UPDATE	248	2026-04-13 14:06:47.431729+00
1542	unos_goriva	evidencija_goriva	UPDATE	249	2026-04-13 14:06:47.431729+00
1543	unos_goriva	evidencija_goriva	UPDATE	250	2026-04-13 14:06:47.431729+00
1544	unos_goriva	evidencija_goriva	UPDATE	251	2026-04-13 14:06:47.431729+00
1545	unos_goriva	evidencija_goriva	UPDATE	252	2026-04-13 14:06:47.431729+00
1546	unos_goriva	evidencija_goriva	UPDATE	253	2026-04-13 14:06:47.431729+00
1547	unos_goriva	evidencija_goriva	UPDATE	254	2026-04-13 14:06:47.431729+00
1548	unos_goriva	evidencija_goriva	UPDATE	255	2026-04-13 14:06:47.431729+00
1549	unos_goriva	evidencija_goriva	UPDATE	256	2026-04-13 14:06:47.431729+00
1550	unos_goriva	evidencija_goriva	UPDATE	257	2026-04-13 14:06:47.431729+00
1551	unos_goriva	evidencija_goriva	UPDATE	258	2026-04-13 14:06:47.431729+00
1552	unos_goriva	evidencija_goriva	UPDATE	259	2026-04-13 14:06:47.431729+00
1553	unos_goriva	evidencija_goriva	UPDATE	260	2026-04-13 14:06:47.431729+00
1554	unos_goriva	evidencija_goriva	UPDATE	261	2026-04-13 14:06:47.431729+00
1555	unos_goriva	evidencija_goriva	UPDATE	262	2026-04-13 14:06:47.431729+00
1556	unos_goriva	evidencija_goriva	UPDATE	263	2026-04-13 14:06:47.431729+00
1557	unos_goriva	evidencija_goriva	UPDATE	264	2026-04-13 14:06:47.431729+00
1558	unos_goriva	evidencija_goriva	UPDATE	265	2026-04-13 14:06:47.431729+00
1559	unos_goriva	evidencija_goriva	UPDATE	266	2026-04-13 14:06:47.431729+00
1560	unos_goriva	evidencija_goriva	UPDATE	267	2026-04-13 14:06:47.431729+00
1561	unos_goriva	evidencija_goriva	UPDATE	268	2026-04-13 14:06:47.431729+00
1562	unos_goriva	evidencija_goriva	UPDATE	269	2026-04-13 14:06:47.431729+00
1563	unos_goriva	evidencija_goriva	UPDATE	270	2026-04-13 14:06:47.431729+00
1564	unos_goriva	evidencija_goriva	UPDATE	271	2026-04-13 14:06:47.431729+00
1565	unos_goriva	evidencija_goriva	UPDATE	272	2026-04-13 14:06:47.431729+00
1566	unos_goriva	evidencija_goriva	UPDATE	273	2026-04-13 14:06:47.431729+00
1567	unos_goriva	evidencija_goriva	UPDATE	274	2026-04-13 14:06:47.431729+00
1568	unos_goriva	evidencija_goriva	UPDATE	275	2026-04-13 14:06:47.431729+00
1569	unos_goriva	evidencija_goriva	UPDATE	276	2026-04-13 14:06:47.431729+00
1570	unos_goriva	evidencija_goriva	UPDATE	277	2026-04-13 14:06:47.431729+00
1571	unos_goriva	evidencija_goriva	UPDATE	278	2026-04-13 14:06:47.431729+00
1572	unos_goriva	evidencija_goriva	UPDATE	279	2026-04-13 14:06:47.431729+00
1573	unos_goriva	evidencija_goriva	UPDATE	280	2026-04-13 14:06:47.431729+00
1574	unos_goriva	evidencija_goriva	UPDATE	281	2026-04-13 14:06:47.431729+00
1575	unos_goriva	evidencija_goriva	UPDATE	282	2026-04-13 14:06:47.431729+00
1576	unos_goriva	evidencija_goriva	UPDATE	283	2026-04-13 14:06:47.431729+00
1577	unos_goriva	evidencija_goriva	UPDATE	284	2026-04-13 14:06:47.431729+00
1578	unos_goriva	evidencija_goriva	UPDATE	285	2026-04-13 14:06:47.431729+00
1579	unos_goriva	evidencija_goriva	UPDATE	286	2026-04-13 14:06:47.431729+00
1580	unos_goriva	evidencija_goriva	UPDATE	287	2026-04-13 14:06:47.431729+00
1581	unos_goriva	evidencija_goriva	UPDATE	288	2026-04-13 14:06:47.431729+00
1582	unos_goriva	evidencija_goriva	UPDATE	289	2026-04-13 14:06:47.431729+00
1583	unos_goriva	evidencija_goriva	UPDATE	290	2026-04-13 14:06:47.431729+00
1584	unos_goriva	evidencija_goriva	UPDATE	291	2026-04-13 14:06:47.431729+00
1585	unos_goriva	evidencija_goriva	UPDATE	292	2026-04-13 14:06:47.431729+00
1586	unos_goriva	evidencija_goriva	UPDATE	293	2026-04-13 14:06:47.431729+00
1587	unos_goriva	evidencija_goriva	UPDATE	294	2026-04-13 14:06:47.431729+00
1588	unos_goriva	evidencija_goriva	UPDATE	295	2026-04-13 14:06:47.431729+00
1589	unos_goriva	evidencija_goriva	UPDATE	296	2026-04-13 14:06:47.431729+00
1590	unos_goriva	evidencija_goriva	UPDATE	297	2026-04-13 14:06:47.431729+00
1591	unos_goriva	evidencija_goriva	UPDATE	298	2026-04-13 14:06:47.431729+00
1592	unos_goriva	evidencija_goriva	UPDATE	299	2026-04-13 14:06:47.431729+00
1593	unos_goriva	evidencija_goriva	UPDATE	300	2026-04-13 14:06:47.431729+00
1594	unos_goriva	evidencija_goriva	UPDATE	301	2026-04-13 14:06:47.431729+00
1595	unos_goriva	evidencija_goriva	UPDATE	302	2026-04-13 14:06:47.431729+00
1596	unos_goriva	evidencija_goriva	UPDATE	303	2026-04-13 14:06:47.431729+00
1597	unos_goriva	evidencija_goriva	UPDATE	304	2026-04-13 14:06:47.431729+00
1598	unos_goriva	evidencija_goriva	UPDATE	305	2026-04-13 14:06:47.431729+00
1599	unos_goriva	evidencija_goriva	UPDATE	306	2026-04-13 14:06:47.431729+00
1600	unos_goriva	evidencija_goriva	UPDATE	307	2026-04-13 14:06:47.431729+00
1601	unos_goriva	evidencija_goriva	UPDATE	308	2026-04-13 14:06:47.431729+00
1602	unos_goriva	evidencija_goriva	UPDATE	309	2026-04-13 14:06:47.431729+00
1603	unos_goriva	evidencija_goriva	UPDATE	310	2026-04-13 14:06:47.431729+00
1604	unos_goriva	evidencija_goriva	UPDATE	311	2026-04-13 14:06:47.431729+00
1605	unos_goriva	evidencija_goriva	UPDATE	312	2026-04-13 14:06:47.431729+00
1606	unos_goriva	evidencija_goriva	UPDATE	313	2026-04-13 14:06:47.431729+00
1607	unos_goriva	evidencija_goriva	UPDATE	314	2026-04-13 14:06:47.431729+00
1608	unos_goriva	evidencija_goriva	UPDATE	315	2026-04-13 14:06:47.431729+00
1609	unos_goriva	evidencija_goriva	UPDATE	316	2026-04-13 14:06:47.431729+00
1610	unos_goriva	evidencija_goriva	UPDATE	317	2026-04-13 14:06:47.431729+00
1611	unos_goriva	evidencija_goriva	UPDATE	318	2026-04-13 14:06:47.431729+00
1612	unos_goriva	evidencija_goriva	UPDATE	319	2026-04-13 14:06:47.431729+00
1613	unos_goriva	evidencija_goriva	UPDATE	320	2026-04-13 14:06:47.431729+00
1614	unos_goriva	evidencija_goriva	UPDATE	321	2026-04-13 14:06:47.431729+00
1615	unos_goriva	evidencija_goriva	UPDATE	322	2026-04-13 14:06:47.431729+00
1616	unos_goriva	evidencija_goriva	UPDATE	323	2026-04-13 14:06:47.431729+00
1617	unos_goriva	evidencija_goriva	UPDATE	324	2026-04-13 14:06:47.431729+00
1618	unos_goriva	evidencija_goriva	UPDATE	325	2026-04-13 14:06:47.431729+00
1619	unos_goriva	evidencija_goriva	UPDATE	326	2026-04-13 14:06:47.431729+00
1620	unos_goriva	evidencija_goriva	UPDATE	327	2026-04-13 14:06:47.431729+00
1621	unos_goriva	evidencija_goriva	UPDATE	328	2026-04-13 14:06:47.431729+00
1622	unos_goriva	evidencija_goriva	UPDATE	329	2026-04-13 14:06:47.431729+00
1623	unos_goriva	evidencija_goriva	UPDATE	330	2026-04-13 14:06:47.431729+00
1624	unos_goriva	evidencija_goriva	UPDATE	331	2026-04-13 14:06:47.431729+00
1625	unos_goriva	evidencija_goriva	UPDATE	332	2026-04-13 14:06:47.431729+00
1626	unos_goriva	evidencija_goriva	UPDATE	333	2026-04-13 14:06:47.431729+00
1627	unos_goriva	evidencija_goriva	UPDATE	334	2026-04-13 14:06:47.431729+00
1628	unos_goriva	evidencija_goriva	UPDATE	335	2026-04-13 14:06:47.431729+00
1629	unos_goriva	evidencija_goriva	UPDATE	336	2026-04-13 14:06:47.431729+00
1630	unos_goriva	evidencija_goriva	UPDATE	337	2026-04-13 14:06:47.431729+00
1631	unos_goriva	evidencija_goriva	UPDATE	338	2026-04-13 14:06:47.431729+00
1632	unos_goriva	evidencija_goriva	UPDATE	339	2026-04-13 14:06:47.431729+00
1633	unos_goriva	evidencija_goriva	UPDATE	340	2026-04-13 14:06:47.431729+00
1634	unos_goriva	evidencija_goriva	UPDATE	341	2026-04-13 14:06:47.431729+00
1635	unos_goriva	evidencija_goriva	UPDATE	342	2026-04-13 14:06:47.431729+00
1636	unos_goriva	evidencija_goriva	UPDATE	343	2026-04-13 14:06:47.431729+00
1637	unos_goriva	evidencija_goriva	UPDATE	344	2026-04-13 14:06:47.431729+00
1638	unos_goriva	evidencija_goriva	UPDATE	345	2026-04-13 14:06:47.431729+00
1639	unos_goriva	evidencija_goriva	UPDATE	346	2026-04-13 14:06:47.431729+00
1640	unos_goriva	evidencija_goriva	UPDATE	347	2026-04-13 14:06:47.431729+00
1641	unos_goriva	evidencija_goriva	UPDATE	348	2026-04-13 14:06:47.431729+00
1642	unos_goriva	evidencija_goriva	UPDATE	349	2026-04-13 14:06:47.431729+00
1643	unos_goriva	evidencija_goriva	UPDATE	350	2026-04-13 14:06:47.431729+00
1644	unos_goriva	evidencija_goriva	UPDATE	351	2026-04-13 14:06:47.431729+00
1645	unos_goriva	evidencija_goriva	UPDATE	352	2026-04-13 14:06:47.431729+00
1646	unos_goriva	evidencija_goriva	UPDATE	353	2026-04-13 14:06:47.431729+00
1647	unos_goriva	evidencija_goriva	UPDATE	354	2026-04-13 14:06:47.431729+00
1648	unos_goriva	evidencija_goriva	UPDATE	355	2026-04-13 14:06:47.431729+00
1649	unos_goriva	evidencija_goriva	UPDATE	356	2026-04-13 14:06:47.431729+00
1650	unos_goriva	evidencija_goriva	UPDATE	357	2026-04-13 14:06:47.431729+00
1651	unos_goriva	evidencija_goriva	UPDATE	358	2026-04-13 14:06:47.431729+00
1652	unos_goriva	evidencija_goriva	UPDATE	359	2026-04-13 14:06:47.431729+00
1653	unos_goriva	evidencija_goriva	UPDATE	360	2026-04-13 14:06:47.431729+00
1654	unos_goriva	evidencija_goriva	UPDATE	361	2026-04-13 14:06:47.431729+00
1655	unos_goriva	evidencija_goriva	UPDATE	362	2026-04-13 14:06:47.431729+00
1656	unos_goriva	evidencija_goriva	UPDATE	363	2026-04-13 14:06:47.431729+00
1657	unos_goriva	evidencija_goriva	UPDATE	364	2026-04-13 14:06:47.431729+00
1658	unos_goriva	evidencija_goriva	UPDATE	365	2026-04-13 14:06:47.431729+00
1659	unos_goriva	evidencija_goriva	UPDATE	366	2026-04-13 14:06:47.431729+00
1660	unos_goriva	evidencija_goriva	UPDATE	367	2026-04-13 14:06:47.431729+00
1661	unos_goriva	evidencija_goriva	UPDATE	368	2026-04-13 14:06:47.431729+00
1662	unos_goriva	evidencija_goriva	UPDATE	369	2026-04-13 14:06:47.431729+00
1663	unos_goriva	evidencija_goriva	UPDATE	370	2026-04-13 14:06:47.431729+00
1664	unos_goriva	evidencija_goriva	UPDATE	371	2026-04-13 14:06:47.431729+00
1665	unos_goriva	evidencija_goriva	UPDATE	372	2026-04-13 14:06:47.431729+00
1666	unos_goriva	evidencija_goriva	UPDATE	373	2026-04-13 14:06:47.431729+00
1667	unos_goriva	evidencija_goriva	UPDATE	374	2026-04-13 14:06:47.431729+00
1668	unos_goriva	evidencija_goriva	UPDATE	375	2026-04-13 14:06:47.431729+00
1669	unos_goriva	evidencija_goriva	UPDATE	376	2026-04-13 14:06:47.431729+00
1670	unos_goriva	evidencija_goriva	UPDATE	377	2026-04-13 14:06:47.431729+00
1671	unos_goriva	evidencija_goriva	UPDATE	378	2026-04-13 14:06:47.431729+00
1672	unos_goriva	evidencija_goriva	UPDATE	379	2026-04-13 14:06:47.431729+00
1673	unos_goriva	evidencija_goriva	UPDATE	380	2026-04-13 14:06:47.431729+00
1674	unos_goriva	evidencija_goriva	UPDATE	381	2026-04-13 14:06:47.431729+00
1675	unos_goriva	evidencija_goriva	UPDATE	382	2026-04-13 14:06:47.431729+00
1676	unos_goriva	evidencija_goriva	UPDATE	383	2026-04-13 14:06:47.431729+00
1677	unos_goriva	evidencija_goriva	UPDATE	384	2026-04-13 14:06:47.431729+00
1678	unos_goriva	evidencija_goriva	UPDATE	385	2026-04-13 14:06:47.431729+00
1679	unos_goriva	evidencija_goriva	UPDATE	386	2026-04-13 14:06:47.431729+00
1680	unos_goriva	evidencija_goriva	UPDATE	387	2026-04-13 14:06:47.431729+00
1681	unos_goriva	evidencija_goriva	UPDATE	388	2026-04-13 14:06:47.431729+00
1682	unos_goriva	evidencija_goriva	UPDATE	389	2026-04-13 14:06:47.431729+00
1683	unos_goriva	evidencija_goriva	UPDATE	390	2026-04-13 14:06:47.431729+00
1684	unos_goriva	evidencija_goriva	UPDATE	391	2026-04-13 14:06:47.431729+00
1685	unos_goriva	evidencija_goriva	UPDATE	392	2026-04-13 14:06:47.431729+00
1686	unos_goriva	evidencija_goriva	UPDATE	393	2026-04-13 14:06:47.431729+00
1687	unos_goriva	evidencija_goriva	UPDATE	394	2026-04-13 14:06:47.431729+00
1688	unos_goriva	evidencija_goriva	UPDATE	395	2026-04-13 14:06:47.431729+00
1689	unos_goriva	evidencija_goriva	UPDATE	396	2026-04-13 14:06:47.431729+00
1690	unos_goriva	evidencija_goriva	UPDATE	397	2026-04-13 14:06:47.431729+00
1691	unos_goriva	evidencija_goriva	UPDATE	398	2026-04-13 14:06:47.431729+00
1692	unos_goriva	evidencija_goriva	UPDATE	399	2026-04-13 14:06:47.431729+00
1693	unos_goriva	evidencija_goriva	UPDATE	400	2026-04-13 14:06:47.431729+00
1694	unos_goriva	evidencija_goriva	UPDATE	401	2026-04-13 14:06:47.431729+00
1695	unos_goriva	evidencija_goriva	UPDATE	402	2026-04-13 14:06:47.431729+00
1696	unos_goriva	evidencija_goriva	UPDATE	403	2026-04-13 14:06:47.431729+00
1697	unos_goriva	evidencija_goriva	UPDATE	404	2026-04-13 14:06:47.431729+00
1698	unos_goriva	evidencija_goriva	UPDATE	405	2026-04-13 14:06:47.431729+00
1699	unos_goriva	evidencija_goriva	UPDATE	406	2026-04-13 14:06:47.431729+00
1700	unos_goriva	evidencija_goriva	UPDATE	407	2026-04-13 14:06:47.431729+00
1701	unos_goriva	evidencija_goriva	UPDATE	408	2026-04-13 14:06:47.431729+00
1702	unos_goriva	evidencija_goriva	UPDATE	409	2026-04-13 14:06:47.431729+00
1703	unos_goriva	evidencija_goriva	UPDATE	410	2026-04-13 14:06:47.431729+00
1704	unos_goriva	evidencija_goriva	UPDATE	411	2026-04-13 14:06:47.431729+00
1705	unos_goriva	evidencija_goriva	UPDATE	412	2026-04-13 14:06:47.431729+00
1706	unos_goriva	evidencija_goriva	UPDATE	413	2026-04-13 14:06:47.431729+00
1707	unos_goriva	evidencija_goriva	UPDATE	414	2026-04-13 14:06:47.431729+00
1708	unos_goriva	evidencija_goriva	UPDATE	415	2026-04-13 14:06:47.431729+00
1709	unos_goriva	evidencija_goriva	UPDATE	416	2026-04-13 14:06:47.431729+00
1710	unos_goriva	evidencija_goriva	UPDATE	417	2026-04-13 14:06:47.431729+00
1711	unos_goriva	evidencija_goriva	UPDATE	418	2026-04-13 14:06:47.431729+00
1712	unos_goriva	evidencija_goriva	UPDATE	419	2026-04-13 14:06:47.431729+00
1713	unos_goriva	evidencija_goriva	UPDATE	420	2026-04-13 14:06:47.431729+00
1714	unos_goriva	evidencija_goriva	UPDATE	421	2026-04-13 14:06:47.431729+00
1715	unos_goriva	evidencija_goriva	UPDATE	422	2026-04-13 14:06:47.431729+00
1716	unos_goriva	evidencija_goriva	UPDATE	423	2026-04-13 14:06:47.431729+00
1717	unos_goriva	evidencija_goriva	UPDATE	424	2026-04-13 14:06:47.431729+00
1718	unos_goriva	evidencija_goriva	UPDATE	425	2026-04-13 14:06:47.431729+00
1719	unos_goriva	evidencija_goriva	UPDATE	426	2026-04-13 14:06:47.431729+00
1720	unos_goriva	evidencija_goriva	UPDATE	427	2026-04-13 14:06:47.431729+00
1721	unos_goriva	evidencija_goriva	UPDATE	428	2026-04-13 14:06:47.431729+00
1722	unos_goriva	evidencija_goriva	UPDATE	429	2026-04-13 14:06:47.431729+00
1723	unos_goriva	evidencija_goriva	UPDATE	430	2026-04-13 14:06:47.431729+00
1724	unos_goriva	evidencija_goriva	UPDATE	431	2026-04-13 14:06:47.431729+00
1725	unos_goriva	evidencija_goriva	UPDATE	432	2026-04-13 14:06:47.431729+00
1726	unos_goriva	evidencija_goriva	UPDATE	433	2026-04-13 14:06:47.431729+00
1727	unos_goriva	evidencija_goriva	UPDATE	434	2026-04-13 14:06:47.431729+00
1728	unos_goriva	evidencija_goriva	UPDATE	435	2026-04-13 14:06:47.431729+00
1729	unos_goriva	evidencija_goriva	UPDATE	436	2026-04-13 14:06:47.431729+00
1730	unos_goriva	evidencija_goriva	UPDATE	437	2026-04-13 14:06:47.431729+00
1731	unos_goriva	evidencija_goriva	UPDATE	438	2026-04-13 14:06:47.431729+00
1732	unos_goriva	evidencija_goriva	UPDATE	439	2026-04-13 14:06:47.431729+00
1733	unos_goriva	evidencija_goriva	UPDATE	440	2026-04-13 14:06:47.431729+00
1734	unos_goriva	evidencija_goriva	UPDATE	441	2026-04-13 14:06:47.431729+00
1735	unos_goriva	evidencija_goriva	UPDATE	442	2026-04-13 14:06:47.431729+00
1736	unos_goriva	evidencija_goriva	UPDATE	443	2026-04-13 14:06:47.431729+00
1737	unos_goriva	evidencija_goriva	UPDATE	444	2026-04-13 14:06:47.431729+00
1738	unos_goriva	evidencija_goriva	UPDATE	445	2026-04-13 14:06:47.431729+00
1739	unos_goriva	evidencija_goriva	UPDATE	446	2026-04-13 14:06:47.431729+00
1740	unos_goriva	evidencija_goriva	UPDATE	447	2026-04-13 14:06:47.431729+00
1741	unos_goriva	evidencija_goriva	UPDATE	448	2026-04-13 14:06:47.431729+00
1742	status_promjena	servisne_intervencije	UPDATE	50	2026-05-05 13:26:56.813844+00
\.


--
-- TOC entry 3996 (class 0 OID 20543)
-- Dependencies: 354
-- Data for Name: drzave; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.drzave (id, naziv) FROM stdin;
1	Bosna i Hercegovina
\.


--
-- TOC entry 4026 (class 0 OID 20734)
-- Dependencies: 384
-- Data for Name: evidencija_goriva; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evidencija_goriva (id, zaduzenje_id, datum, litraza, cijena_po_litri, km_tocenja) FROM stdin;
49	98	2025-10-02 09:30:00	25.00	2.55	54420
50	99	2025-10-18 09:30:00	29.00	2.58	55320
51	100	2025-11-03 09:30:00	21.00	2.61	56220
52	101	2025-11-19 09:30:00	25.00	2.52	57120
53	102	2025-12-05 09:30:00	29.00	2.55	58020
54	103	2025-12-21 09:30:00	21.00	2.58	58920
55	104	2026-01-06 09:30:00	25.00	2.61	59820
56	105	2026-01-22 09:30:00	29.00	2.52	60720
57	106	2026-02-07 09:30:00	21.00	2.55	61620
58	107	2026-02-23 09:30:00	25.00	2.58	62520
59	108	2025-10-03 09:30:00	20.00	2.68	57220
60	109	2025-10-19 09:30:00	23.20	2.71	58120
61	110	2025-11-04 09:30:00	16.80	2.74	59020
62	111	2025-11-20 09:30:00	20.00	2.65	59920
63	112	2025-12-06 09:30:00	23.20	2.68	60820
64	113	2025-12-22 09:30:00	16.80	2.71	61720
65	114	2026-01-07 09:30:00	20.00	2.74	62620
66	115	2026-01-23 09:30:00	23.20	2.65	63520
67	116	2026-02-08 09:30:00	16.80	2.68	64420
68	117	2026-02-24 09:30:00	20.00	2.71	65320
69	118	2025-10-04 09:30:00	22.50	2.68	60020
70	119	2025-10-20 09:30:00	26.10	2.71	60920
71	120	2025-11-05 09:30:00	18.90	2.74	61820
72	121	2025-11-21 09:30:00	22.50	2.65	62720
73	122	2025-12-07 09:30:00	26.10	2.68	63620
74	123	2025-12-23 09:30:00	18.90	2.71	64520
75	124	2026-01-08 09:30:00	22.50	2.74	65420
76	125	2026-01-24 09:30:00	26.10	2.65	66320
77	126	2026-02-09 09:30:00	18.90	2.68	67220
78	127	2026-02-25 09:30:00	22.50	2.71	68120
79	128	2025-10-05 09:30:00	45.00	2.55	62820
80	129	2025-10-21 09:30:00	52.20	2.58	63720
81	130	2025-11-06 09:30:00	37.80	2.61	64620
82	131	2025-11-22 09:30:00	45.00	2.52	65520
83	132	2025-12-08 09:30:00	52.20	2.55	66420
84	133	2025-12-24 09:30:00	37.80	2.58	67320
85	134	2026-01-09 09:30:00	45.00	2.61	68220
86	135	2026-01-25 09:30:00	52.20	2.52	69120
87	136	2026-02-10 09:30:00	37.80	2.55	70020
88	137	2026-02-26 09:30:00	45.00	2.58	70920
89	138	2025-10-06 09:30:00	35.50	2.55	65620
90	139	2025-10-22 09:30:00	41.18	2.58	66520
91	140	2025-11-07 09:30:00	29.82	2.61	67420
92	141	2025-11-23 09:30:00	35.50	2.52	68320
93	142	2025-12-09 09:30:00	41.18	2.55	69220
94	143	2025-12-25 09:30:00	29.82	2.58	70120
95	144	2026-01-10 09:30:00	35.50	2.61	71020
96	145	2026-01-26 09:30:00	41.18	2.52	71920
97	146	2026-02-11 09:30:00	29.82	2.55	72820
98	147	2026-02-27 09:30:00	35.50	2.58	73720
99	148	2025-10-07 09:30:00	33.00	2.55	68420
100	149	2025-10-23 09:30:00	38.28	2.58	69320
101	150	2025-11-08 09:30:00	27.72	2.61	70220
102	151	2025-11-24 09:30:00	33.00	2.52	71120
103	152	2025-12-10 09:30:00	38.28	2.55	72020
104	153	2025-12-26 09:30:00	27.72	2.58	72920
105	154	2026-01-11 09:30:00	33.00	2.61	73820
106	155	2026-01-27 09:30:00	38.28	2.52	74720
107	156	2026-02-12 09:30:00	27.72	2.55	75620
108	157	2026-02-28 09:30:00	33.00	2.58	76520
109	158	2025-10-08 09:30:00	25.00	2.55	71220
110	159	2025-10-24 09:30:00	29.00	2.58	72120
111	160	2025-11-09 09:30:00	21.00	2.61	73020
112	161	2025-11-25 09:30:00	25.00	2.52	73920
113	162	2025-12-11 09:30:00	29.00	2.55	74820
114	163	2025-12-27 09:30:00	21.00	2.58	75720
115	164	2026-01-12 09:30:00	25.00	2.61	76620
116	165	2026-01-28 09:30:00	29.00	2.52	77520
117	166	2026-02-13 09:30:00	21.00	2.55	78420
118	167	2026-03-01 09:30:00	25.00	2.58	79320
119	168	2025-10-09 09:30:00	22.50	2.68	74020
120	169	2025-10-25 09:30:00	26.10	2.71	74920
121	170	2025-11-10 09:30:00	18.90	2.74	75820
122	171	2025-11-26 09:30:00	22.50	2.65	76720
123	172	2025-12-12 09:30:00	26.10	2.68	77620
124	173	2025-12-28 09:30:00	18.90	2.71	78520
125	174	2026-01-13 09:30:00	22.50	2.74	79420
126	175	2026-01-29 09:30:00	26.10	2.65	80320
127	176	2026-02-14 09:30:00	18.90	2.68	81220
128	177	2026-03-02 09:30:00	22.50	2.71	82120
129	178	2025-10-10 09:30:00	40.00	2.55	76820
130	179	2025-10-26 09:30:00	46.40	2.58	77720
131	180	2025-11-11 09:30:00	33.60	2.61	78620
132	181	2025-11-27 09:30:00	40.00	2.52	79520
133	182	2025-12-13 09:30:00	46.40	2.55	80420
134	183	2025-12-29 09:30:00	33.60	2.58	81320
135	184	2026-01-14 09:30:00	40.00	2.61	82220
136	185	2026-01-30 09:30:00	46.40	2.52	83120
137	186	2026-02-15 09:30:00	33.60	2.55	84020
138	187	2026-03-03 09:30:00	40.00	2.58	84920
139	188	2025-10-11 09:30:00	8.00	2.68	79620
140	189	2025-10-27 09:30:00	8.12	2.71	80520
141	190	2025-11-12 09:30:00	8.00	2.74	81420
142	191	2025-11-28 09:30:00	8.00	2.65	82320
143	192	2025-12-14 09:30:00	8.12	2.68	83220
144	193	2025-12-30 09:30:00	8.00	2.71	84120
145	194	2026-01-15 09:30:00	8.00	2.74	85020
146	195	2026-01-31 09:30:00	8.12	2.65	85920
147	196	2026-02-16 09:30:00	8.00	2.68	86820
148	197	2026-03-04 09:30:00	8.00	2.71	87720
149	198	2025-10-12 09:30:00	25.00	2.55	82420
150	199	2025-10-28 09:30:00	29.00	2.58	83320
151	200	2025-11-13 09:30:00	21.00	2.61	84220
152	201	2025-11-29 09:30:00	25.00	2.52	85120
153	202	2025-12-15 09:30:00	29.00	2.55	86020
154	203	2025-12-31 09:30:00	21.00	2.58	86920
155	204	2026-01-16 09:30:00	25.00	2.61	87820
156	205	2026-02-01 09:30:00	29.00	2.52	88720
157	206	2026-02-17 09:30:00	21.00	2.55	89620
158	207	2026-03-05 09:30:00	25.00	2.58	90800
159	208	2025-10-13 09:30:00	20.00	2.68	85220
160	209	2025-10-29 09:30:00	23.20	2.71	86120
161	210	2025-11-14 09:30:00	16.80	2.74	87020
162	211	2025-11-30 09:30:00	20.00	2.65	87920
163	212	2025-12-16 09:30:00	23.20	2.68	88820
164	213	2026-01-01 09:30:00	16.80	2.71	89720
165	214	2026-01-17 09:30:00	20.00	2.74	90620
166	215	2026-02-02 09:30:00	23.20	2.65	91520
167	216	2026-02-18 09:30:00	16.80	2.68	92420
168	217	2026-03-06 09:30:00	20.00	2.71	93600
169	218	2025-10-14 09:30:00	22.50	2.68	88020
170	219	2025-10-30 09:30:00	26.10	2.71	88920
171	220	2025-11-15 09:30:00	18.90	2.74	89820
172	221	2025-12-01 09:30:00	22.50	2.65	90720
173	222	2025-12-17 09:30:00	26.10	2.68	91620
174	223	2026-01-02 09:30:00	18.90	2.71	92520
175	224	2026-01-18 09:30:00	22.50	2.74	93420
176	225	2026-02-03 09:30:00	26.10	2.65	94320
177	226	2026-02-19 09:30:00	18.90	2.68	95220
178	227	2026-03-07 09:30:00	22.50	2.71	96400
179	228	2025-10-15 09:30:00	45.00	2.55	90820
180	229	2025-10-31 09:30:00	52.20	2.58	91720
181	230	2025-11-16 09:30:00	37.80	2.61	92620
182	231	2025-12-02 09:30:00	45.00	2.52	93520
183	232	2025-12-18 09:30:00	52.20	2.55	94420
184	233	2026-01-03 09:30:00	37.80	2.58	95320
185	234	2026-01-19 09:30:00	45.00	2.61	96220
186	235	2026-02-04 09:30:00	52.20	2.52	97120
187	236	2026-02-20 09:30:00	37.80	2.55	98020
188	237	2026-03-08 09:30:00	45.00	2.58	99200
189	238	2025-10-16 09:30:00	35.50	2.55	93620
190	239	2025-11-01 09:30:00	41.18	2.58	94520
191	240	2025-11-17 09:30:00	29.82	2.61	95420
192	241	2025-12-03 09:30:00	35.50	2.52	96320
193	242	2025-12-19 09:30:00	41.18	2.55	97220
194	243	2026-01-04 09:30:00	29.82	2.58	98120
195	244	2026-01-20 09:30:00	35.50	2.61	99020
196	245	2026-02-05 09:30:00	41.18	2.52	99920
197	246	2026-02-21 09:30:00	29.82	2.55	100820
198	247	2026-03-09 09:30:00	35.50	2.58	102000
199	248	2025-10-17 09:30:00	33.00	2.55	96420
200	249	2025-11-02 09:30:00	38.28	2.58	97320
201	250	2025-11-18 09:30:00	27.72	2.61	98220
202	251	2025-12-04 09:30:00	33.00	2.52	99120
203	252	2025-12-20 09:30:00	38.28	2.55	100020
204	253	2026-01-05 09:30:00	27.72	2.58	100920
205	254	2026-01-21 09:30:00	33.00	2.61	101820
206	255	2026-02-06 09:30:00	38.28	2.52	102720
207	256	2026-02-22 09:30:00	27.72	2.55	103620
208	257	2026-03-10 09:30:00	33.00	2.58	104800
209	258	2025-10-18 09:30:00	25.00	2.55	99220
210	259	2025-11-03 09:30:00	29.00	2.58	100120
211	260	2025-11-19 09:30:00	21.00	2.61	101020
212	261	2025-12-05 09:30:00	25.00	2.52	101920
213	262	2025-12-21 09:30:00	29.00	2.55	102820
214	263	2026-01-06 09:30:00	21.00	2.58	103720
215	264	2026-01-22 09:30:00	25.00	2.61	104620
216	265	2026-02-07 09:30:00	29.00	2.52	105520
217	266	2026-02-23 09:30:00	21.00	2.55	106420
218	267	2026-03-11 09:30:00	25.00	2.58	107600
219	268	2025-10-19 09:30:00	22.50	2.68	102020
220	269	2025-11-04 09:30:00	26.10	2.71	102920
221	270	2025-11-20 09:30:00	18.90	2.74	103820
222	271	2025-12-06 09:30:00	22.50	2.65	104720
223	272	2025-12-22 09:30:00	26.10	2.68	105620
224	273	2026-01-07 09:30:00	18.90	2.71	106520
225	274	2026-01-23 09:30:00	22.50	2.74	107420
226	275	2026-02-08 09:30:00	26.10	2.65	108320
227	276	2026-02-24 09:30:00	18.90	2.68	109220
228	277	2026-03-12 09:30:00	22.50	2.71	110400
229	278	2025-10-20 09:30:00	40.00	2.55	104820
230	279	2025-11-05 09:30:00	46.40	2.58	105720
231	280	2025-11-21 09:30:00	33.60	2.61	106620
232	281	2025-12-07 09:30:00	40.00	2.52	107520
233	282	2025-12-23 09:30:00	46.40	2.55	108420
234	283	2026-01-08 09:30:00	33.60	2.58	109320
235	284	2026-01-24 09:30:00	40.00	2.61	110220
236	285	2026-02-09 09:30:00	46.40	2.52	111120
237	286	2026-02-25 09:30:00	33.60	2.55	112020
238	287	2026-03-13 09:30:00	40.00	2.58	112920
239	288	2025-10-21 09:30:00	8.00	2.68	107620
240	289	2025-11-06 09:30:00	8.12	2.71	108520
241	290	2025-11-22 09:30:00	8.00	2.74	109420
242	291	2025-12-08 09:30:00	8.00	2.65	110320
243	292	2025-12-24 09:30:00	8.12	2.68	111220
244	293	2026-01-09 09:30:00	8.00	2.71	112120
245	294	2026-01-25 09:30:00	8.00	2.74	113020
246	295	2026-02-10 09:30:00	8.12	2.65	113920
247	296	2026-02-26 09:30:00	8.00	2.68	114820
248	297	2026-03-14 09:30:00	8.00	2.71	115720
249	298	2025-10-22 09:30:00	25.00	2.55	110420
250	299	2025-11-07 09:30:00	29.00	2.58	111320
251	300	2025-11-23 09:30:00	21.00	2.61	112220
252	301	2025-12-09 09:30:00	25.00	2.52	113120
253	302	2025-12-25 09:30:00	29.00	2.55	114020
254	303	2026-01-10 09:30:00	21.00	2.58	114920
255	304	2026-01-26 09:30:00	25.00	2.61	115820
256	305	2026-02-11 09:30:00	29.00	2.52	116720
257	306	2026-02-27 09:30:00	21.00	2.55	117620
258	307	2026-03-15 09:30:00	25.00	2.58	118520
259	308	2025-10-23 09:30:00	20.00	2.68	113220
260	309	2025-11-08 09:30:00	23.20	2.71	114120
261	310	2025-11-24 09:30:00	16.80	2.74	115020
262	311	2025-12-10 09:30:00	20.00	2.65	115920
263	312	2025-12-26 09:30:00	23.20	2.68	116820
264	313	2026-01-11 09:30:00	16.80	2.71	117720
265	314	2026-01-27 09:30:00	20.00	2.74	118620
266	315	2026-02-12 09:30:00	23.20	2.65	119520
267	316	2026-02-28 09:30:00	16.80	2.68	120420
268	317	2026-03-16 09:30:00	20.00	2.71	121320
269	318	2025-10-24 09:30:00	22.50	2.68	116020
270	319	2025-11-09 09:30:00	26.10	2.71	116920
271	320	2025-11-25 09:30:00	18.90	2.74	117820
272	321	2025-12-11 09:30:00	22.50	2.65	118720
273	322	2025-12-27 09:30:00	26.10	2.68	119620
274	323	2026-01-12 09:30:00	18.90	2.71	120520
275	324	2026-01-28 09:30:00	22.50	2.74	121420
276	325	2026-02-13 09:30:00	26.10	2.65	122320
277	326	2026-03-01 09:30:00	18.90	2.68	123220
278	327	2026-03-17 09:30:00	22.50	2.71	124120
279	328	2025-10-25 09:30:00	45.00	2.55	118820
280	329	2025-11-10 09:30:00	52.20	2.58	119720
281	330	2025-11-26 09:30:00	37.80	2.61	120620
282	331	2025-12-12 09:30:00	45.00	2.52	121520
283	332	2025-12-28 09:30:00	52.20	2.55	122420
284	333	2026-01-13 09:30:00	37.80	2.58	123320
285	334	2026-01-29 09:30:00	45.00	2.61	124220
286	335	2026-02-14 09:30:00	52.20	2.52	125120
287	336	2026-03-02 09:30:00	37.80	2.55	126020
288	337	2026-03-18 09:30:00	45.00	2.58	126920
289	338	2025-10-26 09:30:00	35.50	2.55	121620
290	339	2025-11-11 09:30:00	41.18	2.58	122520
291	340	2025-11-27 09:30:00	29.82	2.61	123420
292	341	2025-12-13 09:30:00	35.50	2.52	124320
293	342	2025-12-29 09:30:00	41.18	2.55	125220
294	343	2026-01-14 09:30:00	29.82	2.58	126120
295	344	2026-01-30 09:30:00	35.50	2.61	127020
296	345	2026-02-15 09:30:00	41.18	2.52	127920
297	346	2026-03-03 09:30:00	29.82	2.55	128820
298	347	2026-03-19 09:30:00	35.50	2.58	129720
299	348	2025-10-27 09:30:00	33.00	2.55	124420
300	349	2025-11-12 09:30:00	38.28	2.58	125320
301	350	2025-11-28 09:30:00	27.72	2.61	126220
302	351	2025-12-14 09:30:00	33.00	2.52	127120
303	352	2025-12-30 09:30:00	38.28	2.55	128020
304	353	2026-01-15 09:30:00	27.72	2.58	128920
305	354	2026-01-31 09:30:00	33.00	2.61	129820
306	355	2026-02-16 09:30:00	38.28	2.52	130720
307	356	2026-03-04 09:30:00	27.72	2.55	131620
308	357	2026-03-20 09:30:00	33.00	2.58	132520
309	358	2025-10-28 09:30:00	25.00	2.55	127220
310	359	2025-11-13 09:30:00	29.00	2.58	128120
311	360	2025-11-29 09:30:00	21.00	2.61	129020
312	361	2025-12-15 09:30:00	25.00	2.52	129920
313	362	2025-12-31 09:30:00	29.00	2.55	130820
314	363	2026-01-16 09:30:00	21.00	2.58	131720
315	364	2026-02-01 09:30:00	25.00	2.61	132620
316	365	2026-02-17 09:30:00	29.00	2.52	133520
317	366	2026-03-05 09:30:00	21.00	2.55	134420
318	367	2026-03-21 09:30:00	25.00	2.58	135320
319	368	2025-10-29 09:30:00	22.50	2.68	130020
320	369	2025-11-14 09:30:00	26.10	2.71	130920
321	370	2025-11-30 09:30:00	18.90	2.74	131820
322	371	2025-12-16 09:30:00	22.50	2.65	132720
323	372	2026-01-01 09:30:00	26.10	2.68	133620
324	373	2026-01-17 09:30:00	18.90	2.71	134520
325	374	2026-02-02 09:30:00	22.50	2.74	135420
326	375	2026-02-18 09:30:00	26.10	2.65	136320
327	376	2026-03-06 09:30:00	18.90	2.68	137220
328	377	2026-03-22 09:30:00	22.50	2.71	138120
329	378	2025-10-30 09:30:00	40.00	2.55	132820
330	379	2025-11-15 09:30:00	46.40	2.58	133720
331	380	2025-12-01 09:30:00	33.60	2.61	134620
332	381	2025-12-17 09:30:00	40.00	2.52	135520
333	382	2026-01-02 09:30:00	46.40	2.55	136420
334	383	2026-01-18 09:30:00	33.60	2.58	137320
335	384	2026-02-03 09:30:00	40.00	2.61	138220
336	385	2026-02-19 09:30:00	46.40	2.52	139120
337	386	2026-03-07 09:30:00	33.60	2.55	140020
338	387	2026-03-23 09:30:00	40.00	2.58	140920
339	388	2025-10-31 09:30:00	8.00	2.68	135620
340	389	2025-11-16 09:30:00	8.12	2.71	136520
341	390	2025-12-02 09:30:00	8.00	2.74	137420
342	391	2025-12-18 09:30:00	8.00	2.65	138320
343	392	2026-01-03 09:30:00	8.12	2.68	139220
344	393	2026-01-19 09:30:00	8.00	2.71	140120
345	394	2026-02-04 09:30:00	8.00	2.74	141020
346	395	2026-02-20 09:30:00	8.12	2.65	141920
347	396	2026-03-08 09:30:00	8.00	2.68	142820
348	397	2026-03-24 09:30:00	8.00	2.71	143720
349	398	2025-11-01 09:30:00	25.00	2.55	138420
350	399	2025-11-17 09:30:00	29.00	2.58	139320
351	400	2025-12-03 09:30:00	21.00	2.61	140220
352	401	2025-12-19 09:30:00	25.00	2.52	141120
353	402	2026-01-04 09:30:00	29.00	2.55	142020
354	403	2026-01-20 09:30:00	21.00	2.58	142920
355	404	2026-02-05 09:30:00	25.00	2.61	143820
356	405	2026-02-21 09:30:00	29.00	2.52	144720
357	406	2026-03-09 09:30:00	21.00	2.55	145620
358	407	2026-03-25 09:30:00	25.00	2.58	146520
359	408	2025-11-02 09:30:00	20.00	2.68	141220
360	409	2025-11-18 09:30:00	23.20	2.71	142120
361	410	2025-12-04 09:30:00	16.80	2.74	143020
362	411	2025-12-20 09:30:00	20.00	2.65	143920
363	412	2026-01-05 09:30:00	23.20	2.68	144820
364	413	2026-01-21 09:30:00	16.80	2.71	145720
365	414	2026-02-06 09:30:00	20.00	2.74	146620
366	415	2026-02-22 09:30:00	23.20	2.65	147520
367	416	2026-03-10 09:30:00	16.80	2.68	148420
368	417	2026-03-26 09:30:00	20.00	2.71	149320
369	418	2025-11-03 09:30:00	22.50	2.68	144020
370	419	2025-11-19 09:30:00	26.10	2.71	144920
371	420	2025-12-05 09:30:00	18.90	2.74	145820
372	421	2025-12-21 09:30:00	22.50	2.65	146720
373	422	2026-01-06 09:30:00	26.10	2.68	147620
374	423	2026-01-22 09:30:00	18.90	2.71	148520
375	424	2026-02-07 09:30:00	22.50	2.74	149420
376	425	2026-02-23 09:30:00	26.10	2.65	150320
377	426	2026-03-11 09:30:00	18.90	2.68	151220
378	427	2026-03-27 09:30:00	22.50	2.71	152120
379	428	2025-11-04 09:30:00	45.00	2.55	146820
380	429	2025-11-20 09:30:00	52.20	2.58	147720
381	430	2025-12-06 09:30:00	37.80	2.61	148620
382	431	2025-12-22 09:30:00	45.00	2.52	149520
383	432	2026-01-07 09:30:00	52.20	2.55	150420
384	433	2026-01-23 09:30:00	37.80	2.58	151320
385	434	2026-02-08 09:30:00	45.00	2.61	152220
386	435	2026-02-24 09:30:00	52.20	2.52	153120
387	436	2026-03-12 09:30:00	37.80	2.55	154020
388	437	2026-03-28 09:30:00	45.00	2.58	154920
389	438	2025-11-05 09:30:00	35.50	2.55	149620
390	439	2025-11-21 09:30:00	41.18	2.58	150520
391	440	2025-12-07 09:30:00	29.82	2.61	151420
392	441	2025-12-23 09:30:00	35.50	2.52	152320
393	442	2026-01-08 09:30:00	41.18	2.55	153220
394	443	2026-01-24 09:30:00	29.82	2.58	154120
395	444	2026-02-09 09:30:00	35.50	2.61	155020
396	445	2026-02-25 09:30:00	41.18	2.52	155920
397	446	2026-03-13 09:30:00	29.82	2.55	156820
398	447	2026-03-29 09:30:00	35.50	2.58	157720
399	448	2025-11-06 09:30:00	33.00	2.55	152420
400	449	2025-11-22 09:30:00	38.28	2.58	153320
401	450	2025-12-08 09:30:00	27.72	2.61	154220
402	451	2025-12-24 09:30:00	33.00	2.52	155120
403	452	2026-01-09 09:30:00	38.28	2.55	156020
404	453	2026-01-25 09:30:00	27.72	2.58	156920
405	454	2026-02-10 09:30:00	33.00	2.61	157820
406	455	2026-02-26 09:30:00	38.28	2.52	158720
407	456	2026-03-14 09:30:00	27.72	2.55	159620
408	457	2026-03-30 09:30:00	33.00	2.58	160520
409	458	2025-11-07 09:30:00	25.00	2.55	155220
410	459	2025-11-23 09:30:00	29.00	2.58	156120
411	460	2025-12-09 09:30:00	21.00	2.61	157020
412	461	2025-12-25 09:30:00	25.00	2.52	157920
413	462	2026-01-10 09:30:00	29.00	2.55	158820
414	463	2026-01-26 09:30:00	21.00	2.58	159720
415	464	2026-02-11 09:30:00	25.00	2.61	160620
416	465	2026-02-27 09:30:00	29.00	2.52	161520
417	466	2026-03-15 09:30:00	21.00	2.55	162420
418	467	2026-03-31 09:30:00	25.00	2.58	163320
419	468	2025-11-08 09:30:00	22.50	2.68	158020
420	469	2025-11-24 09:30:00	26.10	2.71	158920
421	470	2025-12-10 09:30:00	18.90	2.74	159820
422	471	2025-12-26 09:30:00	22.50	2.65	160720
423	472	2026-01-11 09:30:00	26.10	2.68	161620
424	473	2026-01-27 09:30:00	18.90	2.71	162520
425	474	2026-02-12 09:30:00	22.50	2.74	163420
426	475	2026-02-28 09:30:00	26.10	2.65	164320
427	476	2026-03-16 09:30:00	18.90	2.68	165220
428	477	2026-04-01 09:30:00	22.50	2.71	166120
429	478	2025-11-09 09:30:00	40.00	2.55	160820
430	479	2025-11-25 09:30:00	46.40	2.58	161720
431	480	2025-12-11 09:30:00	33.60	2.61	162620
432	481	2025-12-27 09:30:00	40.00	2.52	163520
433	482	2026-01-12 09:30:00	46.40	2.55	164420
434	483	2026-01-28 09:30:00	33.60	2.58	165320
435	484	2026-02-13 09:30:00	40.00	2.61	166220
436	485	2026-03-01 09:30:00	46.40	2.52	167120
437	486	2026-03-17 09:30:00	33.60	2.55	168020
438	487	2026-04-02 09:30:00	40.00	2.58	168920
439	488	2025-11-10 09:30:00	8.00	2.68	163620
440	489	2025-11-26 09:30:00	8.12	2.71	164520
441	490	2025-12-12 09:30:00	8.00	2.74	165420
442	491	2025-12-28 09:30:00	8.00	2.65	166320
443	492	2026-01-13 09:30:00	8.12	2.68	167220
444	493	2026-01-29 09:30:00	8.00	2.71	168120
445	494	2026-02-14 09:30:00	8.00	2.74	169020
446	495	2026-03-02 09:30:00	8.12	2.65	169920
447	496	2026-03-18 09:30:00	8.00	2.68	170820
448	497	2026-04-03 09:30:00	8.00	2.71	171720
\.


--
-- TOC entry 4028 (class 0 OID 20747)
-- Dependencies: 386
-- Data for Name: evidencija_guma; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evidencija_guma (id, vozilo_id, sezona, proizvodjac, datum_kupovine, cijena) FROM stdin;
29	51	Ljetne	Michelin	2025-06-26	322.00
30	51	Zimske	Continental	2024-09-19	357.00
31	51	All season	Pirelli	2023-12-14	392.00
32	51	Zimske	Goodyear	2023-03-09	427.00
33	52	Ljetne	Michelin	2025-06-15	329.00
34	52	Zimske	Continental	2024-09-08	364.00
35	52	All season	Pirelli	2023-12-03	399.00
36	52	Zimske	Goodyear	2023-02-26	434.00
37	53	Ljetne	Michelin	2025-06-04	336.00
38	53	Zimske	Continental	2024-08-28	371.00
39	53	All season	Pirelli	2023-11-22	406.00
40	53	Zimske	Goodyear	2023-02-15	441.00
41	54	Ljetne	Michelin	2025-05-24	343.00
42	54	Zimske	Continental	2024-08-17	378.00
43	54	All season	Pirelli	2023-11-11	413.00
44	54	Zimske	Goodyear	2023-02-04	448.00
45	55	Ljetne	Michelin	2025-05-13	350.00
46	55	Zimske	Continental	2024-08-06	385.00
47	55	All season	Pirelli	2023-10-31	420.00
48	55	Zimske	Goodyear	2023-01-24	455.00
49	56	Ljetne	Michelin	2025-05-02	357.00
50	56	Zimske	Continental	2024-07-26	392.00
51	56	All season	Pirelli	2023-10-20	427.00
52	56	Zimske	Goodyear	2023-01-13	462.00
53	57	Ljetne	Michelin	2025-04-21	364.00
54	57	Zimske	Continental	2024-07-15	399.00
55	57	All season	Pirelli	2023-10-09	434.00
56	57	Zimske	Goodyear	2023-01-02	469.00
57	58	Ljetne	Michelin	2025-04-10	371.00
58	58	Zimske	Continental	2024-07-04	406.00
59	58	All season	Pirelli	2023-09-28	441.00
60	58	Zimske	Goodyear	2022-12-22	476.00
61	59	Ljetne	Michelin	2025-03-30	378.00
62	59	Zimske	Continental	2024-06-23	413.00
63	59	All season	Pirelli	2023-09-17	448.00
64	59	Zimske	Goodyear	2022-12-11	483.00
65	60	Ljetne	Michelin	2025-03-19	385.00
66	60	Zimske	Continental	2024-06-12	420.00
67	60	All season	Pirelli	2023-09-06	455.00
68	60	Zimske	Goodyear	2022-11-30	490.00
69	61	Ljetne	Michelin	2025-03-08	392.00
70	61	Zimske	Continental	2024-06-01	427.00
71	61	All season	Pirelli	2023-08-26	462.00
72	61	Zimske	Goodyear	2022-11-19	497.00
73	62	Ljetne	Michelin	2025-02-25	399.00
74	62	Zimske	Continental	2024-05-21	434.00
75	62	All season	Pirelli	2023-08-15	469.00
76	62	Zimske	Goodyear	2022-11-08	504.00
77	63	Ljetne	Michelin	2025-02-14	406.00
78	63	Zimske	Continental	2024-05-10	441.00
79	63	All season	Pirelli	2023-08-04	476.00
80	63	Zimske	Goodyear	2022-10-28	511.00
81	64	Ljetne	Michelin	2025-02-03	413.00
82	64	Zimske	Continental	2024-04-29	448.00
83	64	All season	Pirelli	2023-07-24	483.00
84	64	Zimske	Goodyear	2022-10-17	518.00
85	65	Ljetne	Michelin	2025-01-23	420.00
86	65	Zimske	Continental	2024-04-18	455.00
87	65	All season	Pirelli	2023-07-13	490.00
88	65	Zimske	Goodyear	2022-10-06	525.00
89	66	Ljetne	Michelin	2025-01-12	427.00
90	66	Zimske	Continental	2024-04-07	462.00
91	66	All season	Pirelli	2023-07-02	497.00
92	66	Zimske	Goodyear	2022-09-25	532.00
93	67	Ljetne	Michelin	2025-01-01	434.00
94	67	Zimske	Continental	2024-03-27	469.00
95	67	All season	Pirelli	2023-06-21	504.00
96	67	Zimske	Goodyear	2022-09-14	539.00
97	68	Ljetne	Michelin	2024-12-21	441.00
98	68	Zimske	Continental	2024-03-16	476.00
99	68	All season	Pirelli	2023-06-10	511.00
100	68	Zimske	Goodyear	2022-09-03	546.00
101	69	Ljetne	Michelin	2024-12-10	448.00
102	69	Zimske	Continental	2024-03-05	483.00
103	69	All season	Pirelli	2023-05-30	518.00
104	69	Zimske	Goodyear	2022-08-23	553.00
105	70	Ljetne	Michelin	2024-11-29	455.00
106	70	Zimske	Continental	2024-02-23	490.00
107	70	All season	Pirelli	2023-05-19	525.00
108	70	Zimske	Goodyear	2022-08-12	560.00
109	71	Ljetne	Michelin	2024-11-18	462.00
110	71	Zimske	Continental	2024-02-12	497.00
111	71	All season	Pirelli	2023-05-08	532.00
112	71	Zimske	Goodyear	2022-08-01	567.00
113	72	Ljetne	Michelin	2024-11-07	469.00
114	72	Zimske	Continental	2024-02-01	504.00
115	72	All season	Pirelli	2023-04-27	539.00
116	72	Zimske	Goodyear	2022-07-21	574.00
117	73	Ljetne	Michelin	2024-10-27	476.00
118	73	Zimske	Continental	2024-01-21	511.00
119	73	All season	Pirelli	2023-04-16	546.00
120	73	Zimske	Goodyear	2022-07-10	581.00
121	74	Ljetne	Michelin	2024-10-16	483.00
122	74	Zimske	Continental	2024-01-10	518.00
123	74	All season	Pirelli	2023-04-05	553.00
124	74	Zimske	Goodyear	2022-06-29	588.00
125	75	Ljetne	Michelin	2024-10-05	490.00
126	75	Zimske	Continental	2023-12-30	525.00
127	75	All season	Pirelli	2023-03-25	560.00
128	75	Zimske	Goodyear	2022-06-18	595.00
129	76	Ljetne	Michelin	2024-09-24	497.00
130	76	Zimske	Continental	2023-12-19	532.00
131	76	All season	Pirelli	2023-03-14	567.00
132	76	Zimske	Goodyear	2022-06-07	602.00
133	77	Ljetne	Michelin	2024-09-13	504.00
134	77	Zimske	Continental	2023-12-08	539.00
135	77	All season	Pirelli	2023-03-03	574.00
136	77	Zimske	Goodyear	2022-05-27	609.00
137	78	Ljetne	Michelin	2024-09-02	511.00
138	78	Zimske	Continental	2023-11-27	546.00
139	78	All season	Pirelli	2023-02-20	581.00
140	78	Zimske	Goodyear	2022-05-16	616.00
141	79	Ljetne	Michelin	2024-08-22	518.00
142	79	Zimske	Continental	2023-11-16	553.00
143	79	All season	Pirelli	2023-02-09	588.00
144	79	Zimske	Goodyear	2022-05-05	623.00
145	80	Ljetne	Michelin	2024-08-11	525.00
146	80	Zimske	Continental	2023-11-05	560.00
147	80	All season	Pirelli	2023-01-29	595.00
148	80	Zimske	Goodyear	2022-04-24	630.00
149	81	Ljetne	Michelin	2024-07-31	532.00
150	81	Zimske	Continental	2023-10-25	567.00
151	81	All season	Pirelli	2023-01-18	602.00
152	81	Zimske	Goodyear	2022-04-13	637.00
153	82	Ljetne	Michelin	2024-07-20	539.00
154	82	Zimske	Continental	2023-10-14	574.00
155	82	All season	Pirelli	2023-01-07	609.00
156	82	Zimske	Goodyear	2022-04-02	644.00
157	83	Ljetne	Michelin	2024-07-09	546.00
158	83	Zimske	Continental	2023-10-03	581.00
159	83	All season	Pirelli	2022-12-27	616.00
160	83	Zimske	Goodyear	2022-03-22	651.00
161	84	Ljetne	Michelin	2024-06-28	553.00
162	84	Zimske	Continental	2023-09-22	588.00
163	84	All season	Pirelli	2022-12-16	623.00
164	84	Zimske	Goodyear	2022-03-11	658.00
165	85	Ljetne	Michelin	2024-06-17	560.00
166	85	Zimske	Continental	2023-09-11	595.00
167	85	All season	Pirelli	2022-12-05	630.00
168	85	Zimske	Goodyear	2022-02-28	665.00
169	86	Ljetne	Michelin	2024-06-06	567.00
170	86	Zimske	Continental	2023-08-31	602.00
171	86	All season	Pirelli	2022-11-24	637.00
172	86	Zimske	Goodyear	2022-02-17	672.00
173	87	Ljetne	Michelin	2024-05-26	574.00
174	87	Zimske	Continental	2023-08-20	609.00
175	87	All season	Pirelli	2022-11-13	644.00
176	87	Zimske	Goodyear	2022-02-06	679.00
177	88	Ljetne	Michelin	2024-05-15	581.00
178	88	Zimske	Continental	2023-08-09	616.00
179	88	All season	Pirelli	2022-11-02	651.00
180	88	Zimske	Goodyear	2022-01-26	686.00
181	89	Ljetne	Michelin	2024-05-04	588.00
182	89	Zimske	Continental	2023-07-29	623.00
183	89	All season	Pirelli	2022-10-22	658.00
184	89	Zimske	Goodyear	2022-01-15	693.00
185	90	Ljetne	Michelin	2024-04-23	595.00
186	90	Zimske	Continental	2023-07-18	630.00
187	90	All season	Pirelli	2022-10-11	665.00
188	90	Zimske	Goodyear	2022-01-04	700.00
\.


--
-- TOC entry 4012 (class 0 OID 20601)
-- Dependencies: 370
-- Data for Name: kategorije_kvarova; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kategorije_kvarova (id, naziv) FROM stdin;
7	Karoserija i limarija
8	Gorivo i ispušni sustav
1	Motor i pogonski sustav
2	Mjenjač i prijenos
3	Elektronika i elektrika
4	Ovjes, upravljanje i kočnice
5	Klimatizacija i hlađenje
6	Unutrašnjost i oprema
9	Veliki/mali servis
\.


--
-- TOC entry 4006 (class 0 OID 20583)
-- Dependencies: 364
-- Data for Name: kategorije_vozila; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kategorije_vozila (id, naziv) FROM stdin;
1	Malo auto
2	Teretno vozilo
3	Motocikl
\.


--
-- TOC entry 4000 (class 0 OID 20560)
-- Dependencies: 358
-- Data for Name: mjesta; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mjesta (id, naziv, zupanija_id) FROM stdin;
6	Bihać	1
7	Bosanska Krupa	1
8	Bosanski Petrovac	1
9	Bužim	1
10	Cazin	1
11	Ključ	1
12	Sanski Most	1
13	Velika Kladuša	1
14	Domaljevac-Šamac	2
15	Odžak	2
16	Orašje	2
17	Banovići	3
18	Čelić	3
19	Doboj Istok	3
20	Gračanica	3
21	Gradačac	3
22	Kalesija	3
23	Kladanj	3
24	Lukavac	3
25	Sapna	3
26	Srebrenik	3
27	Teočak	3
28	Tuzla	3
29	Živinice	3
30	Breza	4
31	Doboj Jug	4
32	Kakanj	4
33	Maglaj	4
34	Olovo	4
35	Tešanj	4
36	Usora	4
37	Vareš	4
38	Visoko	4
39	Zavidovići	4
40	Zenica	4
41	Žepče	4
42	Goražde	5
43	Ustikolina	5
44	Bugojno	6
45	Busovača	6
46	Dobretići	6
47	Donji Vakuf	6
48	Fojnica	6
49	Gornji Vakuf-Uskoplje	6
50	Jajce	6
51	Kiseljak	6
52	Kreševo	6
53	Novi Travnik	6
54	Travnik	6
55	Vitez	6
56	Čapljina	7
57	Čitluk	7
58	Jablanica	7
59	Konjic	7
60	Mostar	7
61	Neum	7
62	Prozor	7
63	Ravno	7
64	Stolac	7
65	Grude	8
66	Ljubuški	8
67	Posušje	8
68	Široki Brijeg	8
69	Hadžići	9
70	Ilidža	9
71	Ilijaš	9
72	Sarajevo - Centar	9
73	Sarajevo - Novi Grad	9
74	Sarajevo - Novo Sarajevo	9
75	Sarajevo - Stari Grad	9
76	Trnovo	9
77	Vogošća	9
78	Bosansko Grahovo	10
79	Drvar	10
80	Glamoč	10
81	Kupres	10
82	Livno	10
83	Tomislavgrad	10
84	Banja Luka	11
85	Čelinac	11
86	Gradiška	11
87	Jezero	11
88	Kneževo	11
89	Kotor Varoš	11
90	Laktaši	11
91	Mrkonjić Grad	11
92	Prnjavor	11
93	Ribnik	11
94	Šipovo	11
95	Srbac	11
96	Brod	12
97	Derventa	12
98	Doboj	12
99	Donji Žabar	12
100	Modriča	12
101	Pelagićevo	12
102	Petrovo	12
103	Šamac	12
104	Stanari	12
105	Teslić	12
106	Vukosavlje	12
107	Han Pijesak	13
108	Istočna Ilidža	13
109	Istočni Stari Grad	13
110	Istočno Sarajevo	13
111	Pale	13
112	Rogatica	13
113	Rudo	13
114	Sokolac	13
115	Višegrad	13
116	Berkovići	14
117	Bileća	14
118	Čajniče	14
119	Foča	14
120	Gacko	14
121	Istočni Mostar	14
122	Kalinovik	14
123	Ljubinje	14
124	Nevesinje	14
125	Novo Goražde	14
126	Trebinje	14
127	Brčko	15
128	Kostajnica	16
129	Kozarska Dubica	16
130	Krupa na Uni	16
131	Novi Grad	16
132	Oštra Luka	16
133	Prijedor	16
134	Bijeljina	17
135	Bratunac	17
136	Lopare	17
137	Milići	17
138	Osmaci	17
139	Šekovići	17
140	Srebrenica	17
141	Ugljevik	17
142	Vlasenica	17
143	Zvornik	17
\.


--
-- TOC entry 4014 (class 0 OID 20607)
-- Dependencies: 372
-- Data for Name: modeli; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.modeli (id, naziv, proizvodjac_id, kategorija_id, tip_goriva_id, kapacitet_rezervoara, mali_servis_interval_km, veliki_servis_interval_km) FROM stdin;
1	Golf 8	1	1	1	50.00	15000	100000
2	Polo	1	1	2	40.00	15000	90000
3	C3	2	1	2	45.00	15000	100000
4	Jumper	2	2	1	90.00	20000	120000
5	Sprinter	3	2	1	71.00	25000	150000
6	C-Class	3	1	1	66.00	20000	120000
7	Octavia	4	1	1	50.00	15000	120000
8	Fabia	4	1	2	45.00	15000	90000
9	Hilux	5	2	1	80.00	15000	150000
10	MT-07	6	3	2	14.00	10000	40000
\.


--
-- TOC entry 4004 (class 0 OID 20577)
-- Dependencies: 362
-- Data for Name: proizvodjaci; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proizvodjaci (id, naziv) FROM stdin;
1	Volkswagen
2	Citroen
3	Mercedes-Benz
4	Skoda
5	Toyota
6	Yamaha
\.


--
-- TOC entry 4022 (class 0 OID 20694)
-- Dependencies: 380
-- Data for Name: registracije; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.registracije (id, vozilo_id, registracijska_oznaka, datum_registracije, datum_isteka, cijena) FROM stdin;
53	51	A01-I-201	2022-03-25	2023-03-25	147.00
54	51	A01-I-201	2023-03-25	2024-03-24	152.00
55	51	A01-I-201	2024-03-24	2025-03-24	157.00
56	51	A01-I-201	2025-03-24	2026-03-24	162.00
57	52	B02-J-202	2022-04-09	2023-04-09	149.00
58	52	B02-J-202	2023-04-09	2024-04-08	154.00
59	52	B02-J-202	2024-04-08	2025-04-08	159.00
60	52	B02-J-202	2025-04-08	2026-04-08	164.00
61	53	C03-K-203	2022-04-17	2023-04-17	151.00
62	53	C03-K-203	2023-04-17	2024-04-16	156.00
63	53	C03-K-203	2024-04-16	2025-04-16	161.00
64	53	C03-K-203	2025-04-16	2026-04-16	166.00
65	54	D04-L-204	2022-04-25	2023-04-25	153.00
66	54	D04-L-204	2023-04-25	2024-04-24	158.00
67	54	D04-L-204	2024-04-24	2025-04-24	163.00
68	54	D04-L-204	2025-04-24	2026-04-24	168.00
69	55	E05-M-205	2022-05-02	2023-05-02	155.00
70	55	E05-M-205	2023-05-02	2024-05-01	160.00
71	55	E05-M-205	2024-05-01	2025-05-01	165.00
72	55	E05-M-205	2025-05-01	2026-05-01	170.00
73	56	F06-N-206	2022-08-18	2023-08-18	157.00
74	56	F06-N-206	2023-08-18	2024-08-17	162.00
75	56	F06-N-206	2024-08-17	2025-08-17	167.00
76	56	F06-N-206	2025-08-17	2026-08-17	172.00
77	57	G07-O-207	2022-08-19	2023-08-19	159.00
78	57	G07-O-207	2023-08-19	2024-08-18	164.00
79	57	G07-O-207	2024-08-18	2025-08-18	169.00
80	57	G07-O-207	2025-08-18	2026-08-18	174.00
81	58	H08-P-208	2022-08-20	2023-08-20	161.00
82	58	H08-P-208	2023-08-20	2024-08-19	166.00
83	58	H08-P-208	2024-08-19	2025-08-19	171.00
84	58	H08-P-208	2025-08-19	2026-08-19	176.00
85	59	I09-Q-209	2022-08-21	2023-08-21	163.00
86	59	I09-Q-209	2023-08-21	2024-08-20	168.00
87	59	I09-Q-209	2024-08-20	2025-08-20	173.00
88	59	I09-Q-209	2025-08-20	2026-08-20	178.00
89	60	J10-R-210	2022-08-22	2023-08-22	165.00
90	60	J10-R-210	2023-08-22	2024-08-21	170.00
91	60	J10-R-210	2024-08-21	2025-08-21	175.00
92	60	J10-R-210	2025-08-21	2026-08-21	180.00
93	61	K11-S-211	2022-08-23	2023-08-23	167.00
94	61	K11-S-211	2023-08-23	2024-08-22	172.00
95	61	K11-S-211	2024-08-22	2025-08-22	177.00
96	61	K11-S-211	2025-08-22	2026-08-22	182.00
97	62	L12-T-212	2022-08-24	2023-08-24	169.00
98	62	L12-T-212	2023-08-24	2024-08-23	174.00
99	62	L12-T-212	2024-08-23	2025-08-23	179.00
100	62	L12-T-212	2025-08-23	2026-08-23	184.00
101	63	M13-U-213	2022-08-25	2023-08-25	171.00
102	63	M13-U-213	2023-08-25	2024-08-24	176.00
103	63	M13-U-213	2024-08-24	2025-08-24	181.00
104	63	M13-U-213	2025-08-24	2026-08-24	186.00
105	64	N14-V-214	2022-08-26	2023-08-26	173.00
106	64	N14-V-214	2023-08-26	2024-08-25	178.00
107	64	N14-V-214	2024-08-25	2025-08-25	183.00
108	64	N14-V-214	2025-08-25	2026-08-25	188.00
109	65	O15-W-215	2022-08-27	2023-08-27	175.00
110	65	O15-W-215	2023-08-27	2024-08-26	180.00
111	65	O15-W-215	2024-08-26	2025-08-26	185.00
112	65	O15-W-215	2025-08-26	2026-08-26	190.00
113	66	P16-X-216	2022-08-28	2023-08-28	177.00
114	66	P16-X-216	2023-08-28	2024-08-27	182.00
115	66	P16-X-216	2024-08-27	2025-08-27	187.00
116	66	P16-X-216	2025-08-27	2026-08-27	192.00
117	67	Q17-Y-217	2022-08-29	2023-08-29	179.00
118	67	Q17-Y-217	2023-08-29	2024-08-28	184.00
119	67	Q17-Y-217	2024-08-28	2025-08-28	189.00
120	67	Q17-Y-217	2025-08-28	2026-08-28	194.00
121	68	R18-Z-218	2022-08-30	2023-08-30	181.00
122	68	R18-Z-218	2023-08-30	2024-08-29	186.00
123	68	R18-Z-218	2024-08-29	2025-08-29	191.00
124	68	R18-Z-218	2025-08-29	2026-08-29	196.00
125	69	S19-A-219	2022-08-31	2023-08-31	183.00
126	69	S19-A-219	2023-08-31	2024-08-30	188.00
127	69	S19-A-219	2024-08-30	2025-08-30	193.00
128	69	S19-A-219	2025-08-30	2026-08-30	198.00
129	70	T20-B-220	2022-09-01	2023-09-01	185.00
130	70	T20-B-220	2023-09-01	2024-08-31	190.00
131	70	T20-B-220	2024-08-31	2025-08-31	195.00
132	70	T20-B-220	2025-08-31	2026-08-31	200.00
133	71	U21-C-221	2022-09-02	2023-09-02	187.00
134	71	U21-C-221	2023-09-02	2024-09-01	192.00
135	71	U21-C-221	2024-09-01	2025-09-01	197.00
136	71	U21-C-221	2025-09-01	2026-09-01	202.00
137	72	V22-D-222	2022-09-03	2023-09-03	189.00
138	72	V22-D-222	2023-09-03	2024-09-02	194.00
139	72	V22-D-222	2024-09-02	2025-09-02	199.00
140	72	V22-D-222	2025-09-02	2026-09-02	204.00
141	73	W23-E-223	2022-09-04	2023-09-04	191.00
142	73	W23-E-223	2023-09-04	2024-09-03	196.00
143	73	W23-E-223	2024-09-03	2025-09-03	201.00
144	73	W23-E-223	2025-09-03	2026-09-03	206.00
145	74	X24-F-224	2022-09-05	2023-09-05	193.00
146	74	X24-F-224	2023-09-05	2024-09-04	198.00
147	74	X24-F-224	2024-09-04	2025-09-04	203.00
148	74	X24-F-224	2025-09-04	2026-09-04	208.00
149	75	Y25-G-225	2022-09-06	2023-09-06	195.00
150	75	Y25-G-225	2023-09-06	2024-09-05	200.00
151	75	Y25-G-225	2024-09-05	2025-09-05	205.00
152	75	Y25-G-225	2025-09-05	2026-09-05	210.00
153	76	Z26-H-226	2022-09-07	2023-09-07	197.00
154	76	Z26-H-226	2023-09-07	2024-09-06	202.00
155	76	Z26-H-226	2024-09-06	2025-09-06	207.00
156	76	Z26-H-226	2025-09-06	2026-09-06	212.00
157	77	A27-I-227	2022-09-08	2023-09-08	199.00
158	77	A27-I-227	2023-09-08	2024-09-07	204.00
159	77	A27-I-227	2024-09-07	2025-09-07	209.00
160	77	A27-I-227	2025-09-07	2026-09-07	214.00
161	78	B28-J-228	2022-09-09	2023-09-09	201.00
162	78	B28-J-228	2023-09-09	2024-09-08	206.00
163	78	B28-J-228	2024-09-08	2025-09-08	211.00
164	78	B28-J-228	2025-09-08	2026-09-08	216.00
165	79	C29-K-229	2022-09-10	2023-09-10	203.00
166	79	C29-K-229	2023-09-10	2024-09-09	208.00
167	79	C29-K-229	2024-09-09	2025-09-09	213.00
168	79	C29-K-229	2025-09-09	2026-09-09	218.00
169	80	D30-L-230	2022-09-11	2023-09-11	205.00
170	80	D30-L-230	2023-09-11	2024-09-10	210.00
171	80	D30-L-230	2024-09-10	2025-09-10	215.00
172	80	D30-L-230	2025-09-10	2026-09-10	220.00
173	81	E31-M-231	2022-09-12	2023-09-12	207.00
174	81	E31-M-231	2023-09-12	2024-09-11	212.00
175	81	E31-M-231	2024-09-11	2025-09-11	217.00
176	81	E31-M-231	2025-09-11	2026-09-11	222.00
177	82	F32-N-232	2022-09-13	2023-09-13	209.00
178	82	F32-N-232	2023-09-13	2024-09-12	214.00
179	82	F32-N-232	2024-09-12	2025-09-12	219.00
180	82	F32-N-232	2025-09-12	2026-09-12	224.00
181	83	G33-O-233	2022-09-14	2023-09-14	211.00
182	83	G33-O-233	2023-09-14	2024-09-13	216.00
183	83	G33-O-233	2024-09-13	2025-09-13	221.00
184	83	G33-O-233	2025-09-13	2026-09-13	226.00
185	84	H34-P-234	2022-09-15	2023-09-15	213.00
186	84	H34-P-234	2023-09-15	2024-09-14	218.00
187	84	H34-P-234	2024-09-14	2025-09-14	223.00
188	84	H34-P-234	2025-09-14	2026-09-14	228.00
189	85	I35-Q-235	2022-09-16	2023-09-16	215.00
190	85	I35-Q-235	2023-09-16	2024-09-15	220.00
191	85	I35-Q-235	2024-09-15	2025-09-15	225.00
192	85	I35-Q-235	2025-09-15	2026-09-15	230.00
193	86	J36-R-236	2022-09-17	2023-09-17	217.00
194	86	J36-R-236	2023-09-17	2024-09-16	222.00
195	86	J36-R-236	2024-09-16	2025-09-16	227.00
196	86	J36-R-236	2025-09-16	2026-09-16	232.00
197	87	K37-S-237	2022-09-18	2023-09-18	219.00
198	87	K37-S-237	2023-09-18	2024-09-17	224.00
199	87	K37-S-237	2024-09-17	2025-09-17	229.00
200	87	K37-S-237	2025-09-17	2026-09-17	234.00
201	88	L38-T-238	2022-09-19	2023-09-19	221.00
202	88	L38-T-238	2023-09-19	2024-09-18	226.00
203	88	L38-T-238	2024-09-18	2025-09-18	231.00
204	88	L38-T-238	2025-09-18	2026-09-18	236.00
205	89	M39-U-239	2022-09-20	2023-09-20	223.00
206	89	M39-U-239	2023-09-20	2024-09-19	228.00
207	89	M39-U-239	2024-09-19	2025-09-19	233.00
208	89	M39-U-239	2025-09-19	2026-09-19	238.00
209	90	N40-V-240	2022-09-21	2023-09-21	225.00
210	90	N40-V-240	2023-09-21	2024-09-20	230.00
211	90	N40-V-240	2024-09-20	2025-09-20	235.00
212	90	N40-V-240	2025-09-20	2026-09-20	240.00
\.


--
-- TOC entry 4024 (class 0 OID 20705)
-- Dependencies: 382
-- Data for Name: servisne_intervencije; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.servisne_intervencije (id, vozilo_id, datum_pocetka, datum_zavrsetka, km_u_tom_trenutku, cijena, opis, kategorija_id, zaposlenik_id, hitnost, status_prijave, attachment_url) FROM stdin;
50	51	2026-01-17 09:20:00	2026-05-05 13:26:56.182	62280	250.00	Vozilo je u obradi zbog aktivnog kvara na pogonskom sustavu.	4	35	kriticno	zatvoreno	\N
41	51	2025-10-01 09:20:00	2025-10-02 15:20:00	57600	160.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	srednje	zatvoreno	\N
42	51	2025-10-13 09:20:00	2025-10-14 15:20:00	58120	197.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	srednje	zatvoreno	\N
43	51	2025-10-25 09:20:00	2025-10-26 15:20:00	58640	234.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	28	nisko	zatvoreno	\N
44	51	2025-11-06 09:20:00	2025-11-07 15:20:00	59160	451.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	29	visoko	zatvoreno	\N
45	51	2025-11-18 09:20:00	2025-11-19 15:20:00	59680	308.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	srednje	zatvoreno	\N
46	51	2025-11-30 09:20:00	2025-12-01 15:20:00	60200	345.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	nisko	zatvoreno	\N
47	51	2025-12-12 09:20:00	2025-12-13 15:20:00	60720	382.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	32	srednje	zatvoreno	\N
48	51	2025-12-24 09:20:00	2025-12-25 15:20:00	61240	599.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	33	visoko	zatvoreno	\N
49	51	2026-01-05 09:20:00	2026-01-06 15:20:00	61760	456.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	nisko	zatvoreno	\N
51	52	2025-10-03 09:20:00	2025-10-04 15:20:00	60400	163.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	srednje	zatvoreno	\N
52	52	2025-10-15 09:20:00	2025-10-16 15:20:00	60920	200.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	srednje	zatvoreno	\N
53	52	2025-10-27 09:20:00	2025-10-28 15:20:00	61440	237.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	31	nisko	zatvoreno	\N
54	52	2025-11-08 09:20:00	2025-11-09 15:20:00	61960	454.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	32	visoko	zatvoreno	\N
55	52	2025-11-20 09:20:00	2025-11-21 15:20:00	62480	311.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	srednje	zatvoreno	\N
56	52	2025-12-02 09:20:00	2025-12-03 15:20:00	63000	348.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	nisko	zatvoreno	\N
57	52	2025-12-14 09:20:00	2025-12-15 15:20:00	63520	385.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	35	srednje	zatvoreno	\N
58	52	2025-12-26 09:20:00	2025-12-27 15:20:00	64040	602.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	36	visoko	zatvoreno	\N
59	52	2026-01-07 09:20:00	2026-01-08 15:20:00	64560	459.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	nisko	zatvoreno	\N
60	52	2026-01-19 09:20:00	\N	65080	\N	Vozilo je u obradi zbog aktivnog kvara na pogonskom sustavu.	5	38	kriticno	u_obradi	\N
61	53	2025-10-05 09:20:00	2025-10-06 15:20:00	63200	166.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	srednje	zatvoreno	\N
62	53	2025-10-17 09:20:00	2025-10-18 15:20:00	63720	203.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	srednje	zatvoreno	\N
63	53	2025-10-29 09:20:00	2025-10-30 15:20:00	64240	240.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	34	nisko	zatvoreno	\N
64	53	2025-11-10 09:20:00	2025-11-11 15:20:00	64760	457.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	35	visoko	zatvoreno	\N
65	53	2025-11-22 09:20:00	2025-11-23 15:20:00	65280	314.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	srednje	zatvoreno	\N
66	53	2025-12-04 09:20:00	2025-12-05 15:20:00	65800	351.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	nisko	zatvoreno	\N
67	53	2025-12-16 09:20:00	2025-12-17 15:20:00	66320	388.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	38	srednje	zatvoreno	\N
68	53	2025-12-28 09:20:00	2025-12-29 15:20:00	66840	605.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	23	visoko	zatvoreno	\N
69	53	2026-01-09 09:20:00	2026-01-10 15:20:00	67360	462.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	nisko	zatvoreno	\N
70	53	2026-01-21 09:20:00	\N	67880	\N	Vozilo je u obradi zbog aktivnog kvara na pogonskom sustavu.	6	25	kriticno	u_obradi	\N
71	54	2025-10-07 09:20:00	2025-10-08 15:20:00	66000	169.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	srednje	zatvoreno	\N
72	54	2025-10-19 09:20:00	2025-10-20 15:20:00	66520	206.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	srednje	zatvoreno	\N
73	54	2025-10-31 09:20:00	2025-11-01 15:20:00	67040	243.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	37	nisko	zatvoreno	\N
74	54	2025-11-12 09:20:00	2025-11-13 15:20:00	67560	460.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	38	visoko	zatvoreno	\N
75	54	2025-11-24 09:20:00	2025-11-25 15:20:00	68080	317.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	srednje	zatvoreno	\N
76	54	2025-12-06 09:20:00	2025-12-07 15:20:00	68600	354.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	nisko	zatvoreno	\N
77	54	2025-12-18 09:20:00	2025-12-19 15:20:00	69120	391.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	25	srednje	zatvoreno	\N
78	54	2025-12-30 09:20:00	2025-12-31 15:20:00	69640	608.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	26	visoko	zatvoreno	\N
79	54	2026-01-11 09:20:00	2026-01-12 15:20:00	70160	465.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	nisko	zatvoreno	\N
80	54	2026-01-23 09:20:00	\N	70680	\N	Vozilo je u obradi zbog aktivnog kvara na pogonskom sustavu.	7	28	kriticno	u_obradi	\N
81	55	2025-10-09 09:20:00	2025-10-10 15:20:00	68800	172.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	srednje	zatvoreno	\N
82	55	2025-10-21 09:20:00	2025-10-22 15:20:00	69320	209.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	srednje	zatvoreno	\N
83	55	2025-11-02 09:20:00	2025-11-03 15:20:00	69840	246.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	24	nisko	zatvoreno	\N
84	55	2025-11-14 09:20:00	2025-11-15 15:20:00	70360	463.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	25	visoko	zatvoreno	\N
85	55	2025-11-26 09:20:00	2025-11-27 15:20:00	70880	320.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	srednje	zatvoreno	\N
86	55	2025-12-08 09:20:00	2025-12-09 15:20:00	71400	357.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	nisko	zatvoreno	\N
87	55	2025-12-20 09:20:00	2025-12-21 15:20:00	71920	394.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	28	srednje	zatvoreno	\N
88	55	2026-01-01 09:20:00	2026-01-02 15:20:00	72440	611.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	29	visoko	zatvoreno	\N
89	55	2026-01-13 09:20:00	2026-01-14 15:20:00	72960	468.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	nisko	zatvoreno	\N
90	55	2026-01-25 09:20:00	\N	73480	\N	Novo prijavljen kvar, ceka inicijalnu obradu i dijagnostiku.	8	31	visoko	novo	\N
91	56	2025-10-11 09:20:00	2025-10-12 15:20:00	71600	175.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	srednje	zatvoreno	\N
92	56	2025-10-23 09:20:00	2025-10-24 15:20:00	72120	212.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	srednje	zatvoreno	\N
93	56	2025-11-04 09:20:00	2025-11-05 15:20:00	72640	249.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	27	nisko	zatvoreno	\N
94	56	2025-11-16 09:20:00	2025-11-17 15:20:00	73160	466.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	28	visoko	zatvoreno	\N
95	56	2025-11-28 09:20:00	2025-11-29 15:20:00	73680	323.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	srednje	zatvoreno	\N
96	56	2025-12-10 09:20:00	2025-12-11 15:20:00	74200	360.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	nisko	zatvoreno	\N
97	56	2025-12-22 09:20:00	2025-12-23 15:20:00	74720	397.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	31	srednje	zatvoreno	\N
98	56	2026-01-03 09:20:00	2026-01-04 15:20:00	75240	614.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	32	visoko	zatvoreno	\N
99	56	2026-01-15 09:20:00	2026-01-16 15:20:00	75760	471.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	nisko	zatvoreno	\N
100	56	2026-01-27 09:20:00	\N	76280	\N	Novo prijavljen kvar, ceka inicijalnu obradu i dijagnostiku.	1	34	visoko	novo	\N
101	57	2025-10-13 09:20:00	2025-10-14 15:20:00	74400	178.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	srednje	zatvoreno	\N
102	57	2025-10-25 09:20:00	2025-10-26 15:20:00	74920	215.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	srednje	zatvoreno	\N
103	57	2025-11-06 09:20:00	2025-11-07 15:20:00	75440	252.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	30	nisko	zatvoreno	\N
104	57	2025-11-18 09:20:00	2025-11-19 15:20:00	75960	469.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	31	visoko	zatvoreno	\N
105	57	2025-11-30 09:20:00	2025-12-01 15:20:00	76480	326.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	srednje	zatvoreno	\N
106	57	2025-12-12 09:20:00	2025-12-13 15:20:00	77000	363.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	nisko	zatvoreno	\N
107	57	2025-12-24 09:20:00	2025-12-25 15:20:00	77520	400.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	34	srednje	zatvoreno	\N
108	57	2026-01-05 09:20:00	2026-01-06 15:20:00	78040	617.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	35	visoko	zatvoreno	\N
109	57	2026-01-17 09:20:00	2026-01-18 15:20:00	78560	474.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	nisko	zatvoreno	\N
110	57	2026-01-29 09:20:00	\N	79080	\N	Novo prijavljen kvar, ceka inicijalnu obradu i dijagnostiku.	2	37	visoko	novo	\N
111	58	2025-10-15 09:20:00	2025-10-16 15:20:00	77200	181.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	srednje	zatvoreno	\N
112	58	2025-10-27 09:20:00	2025-10-28 15:20:00	77720	218.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	srednje	zatvoreno	\N
113	58	2025-11-08 09:20:00	2025-11-09 15:20:00	78240	255.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	33	nisko	zatvoreno	\N
114	58	2025-11-20 09:20:00	2025-11-21 15:20:00	78760	472.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	34	visoko	zatvoreno	\N
115	58	2025-12-02 09:20:00	2025-12-03 15:20:00	79280	329.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	srednje	zatvoreno	\N
116	58	2025-12-14 09:20:00	2025-12-15 15:20:00	79800	366.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	nisko	zatvoreno	\N
117	58	2025-12-26 09:20:00	2025-12-27 15:20:00	80320	403.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	37	srednje	zatvoreno	\N
118	58	2026-01-07 09:20:00	2026-01-08 15:20:00	80840	620.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	38	visoko	zatvoreno	\N
119	58	2026-01-19 09:20:00	2026-01-20 15:20:00	81360	477.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	nisko	zatvoreno	\N
120	58	2026-01-31 09:20:00	\N	81880	\N	Novo prijavljen kvar, ceka inicijalnu obradu i dijagnostiku.	3	24	visoko	novo	\N
121	59	2025-10-17 09:20:00	2025-10-18 15:20:00	80000	184.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	srednje	zatvoreno	\N
122	59	2025-10-29 09:20:00	2025-10-30 15:20:00	80520	221.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	35	srednje	zatvoreno	\N
123	59	2025-11-10 09:20:00	2025-11-11 15:20:00	81040	258.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	36	nisko	zatvoreno	\N
124	59	2025-11-22 09:20:00	2025-11-23 15:20:00	81560	475.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	37	visoko	zatvoreno	\N
125	59	2025-12-04 09:20:00	2025-12-05 15:20:00	82080	332.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	srednje	zatvoreno	\N
126	59	2025-12-16 09:20:00	2025-12-17 15:20:00	82600	369.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	nisko	zatvoreno	\N
127	59	2025-12-28 09:20:00	2025-12-29 15:20:00	83120	406.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	24	srednje	zatvoreno	\N
128	59	2026-01-09 09:20:00	2026-01-10 15:20:00	83640	623.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	25	visoko	zatvoreno	\N
129	59	2026-01-21 09:20:00	2026-01-22 15:20:00	84160	480.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	nisko	zatvoreno	\N
130	59	2026-02-02 09:20:00	\N	84680	\N	Novo prijavljen kvar, ceka inicijalnu obradu i dijagnostiku.	4	27	visoko	novo	\N
131	60	2025-10-19 09:20:00	2025-10-20 15:20:00	82800	187.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	srednje	zatvoreno	\N
132	60	2025-10-31 09:20:00	2025-11-01 15:20:00	83320	224.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	38	srednje	zatvoreno	\N
133	60	2025-11-12 09:20:00	2025-11-13 15:20:00	83840	261.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	23	nisko	zatvoreno	\N
134	60	2025-11-24 09:20:00	2025-11-25 15:20:00	84360	478.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	24	visoko	zatvoreno	\N
135	60	2025-12-06 09:20:00	2025-12-07 15:20:00	84880	335.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	srednje	zatvoreno	\N
136	60	2025-12-18 09:20:00	2025-12-19 15:20:00	85400	372.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	nisko	zatvoreno	\N
137	60	2025-12-30 09:20:00	2025-12-31 15:20:00	85920	409.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	27	srednje	zatvoreno	\N
138	60	2026-01-11 09:20:00	2026-01-12 15:20:00	86440	626.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	28	visoko	zatvoreno	\N
139	60	2026-01-23 09:20:00	2026-01-24 15:20:00	86960	483.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	nisko	zatvoreno	\N
140	60	2026-02-04 09:20:00	\N	87480	\N	Novo prijavljen kvar, ceka inicijalnu obradu i dijagnostiku.	5	30	visoko	novo	\N
141	61	2025-10-21 09:20:00	2025-10-22 15:20:00	85600	190.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	srednje	zatvoreno	\N
142	61	2025-11-02 09:20:00	2025-11-03 15:20:00	86120	227.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	25	srednje	zatvoreno	\N
143	61	2025-11-14 09:20:00	2025-11-15 15:20:00	86640	264.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	26	nisko	zatvoreno	\N
144	61	2025-11-26 09:20:00	2025-11-27 15:20:00	87160	481.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	27	visoko	zatvoreno	\N
145	61	2025-12-08 09:20:00	2025-12-09 15:20:00	87680	338.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	srednje	zatvoreno	\N
146	61	2025-12-20 09:20:00	2025-12-21 15:20:00	88200	375.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	nisko	zatvoreno	\N
147	61	2026-01-01 09:20:00	2026-01-02 15:20:00	88720	412.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	30	srednje	zatvoreno	\N
148	61	2026-01-13 09:20:00	2026-01-14 15:20:00	89240	629.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	31	visoko	zatvoreno	\N
149	61	2026-01-25 09:20:00	2026-01-26 15:20:00	89760	486.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	nisko	zatvoreno	\N
150	61	2026-02-06 09:20:00	2026-02-07 15:20:00	90280	523.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	srednje	zatvoreno	\N
151	62	2025-10-23 09:20:00	2025-10-24 15:20:00	88400	193.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	srednje	zatvoreno	\N
152	62	2025-11-04 09:20:00	2025-11-05 15:20:00	88920	230.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	28	srednje	zatvoreno	\N
153	62	2025-11-16 09:20:00	2025-11-17 15:20:00	89440	267.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	29	nisko	zatvoreno	\N
154	62	2025-11-28 09:20:00	2025-11-29 15:20:00	89960	484.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	30	visoko	zatvoreno	\N
155	62	2025-12-10 09:20:00	2025-12-11 15:20:00	90480	341.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	srednje	zatvoreno	\N
156	62	2025-12-22 09:20:00	2025-12-23 15:20:00	91000	378.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	nisko	zatvoreno	\N
157	62	2026-01-03 09:20:00	2026-01-04 15:20:00	91520	415.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	33	srednje	zatvoreno	\N
158	62	2026-01-15 09:20:00	2026-01-16 15:20:00	92040	632.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	34	visoko	zatvoreno	\N
159	62	2026-01-27 09:20:00	2026-01-28 15:20:00	92560	489.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	nisko	zatvoreno	\N
160	62	2026-02-08 09:20:00	2026-02-09 15:20:00	93080	526.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	srednje	zatvoreno	\N
161	63	2025-10-25 09:20:00	2025-10-26 15:20:00	91200	196.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	srednje	zatvoreno	\N
162	63	2025-11-06 09:20:00	2025-11-07 15:20:00	91720	233.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	srednje	zatvoreno	\N
163	63	2025-11-18 09:20:00	2025-11-19 15:20:00	92240	270.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	32	nisko	zatvoreno	\N
164	63	2025-11-30 09:20:00	2025-12-01 15:20:00	92760	487.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	33	visoko	zatvoreno	\N
165	63	2025-12-12 09:20:00	2025-12-13 15:20:00	93280	344.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	srednje	zatvoreno	\N
166	63	2025-12-24 09:20:00	2025-12-25 15:20:00	93800	381.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	35	nisko	zatvoreno	\N
167	63	2026-01-05 09:20:00	2026-01-06 15:20:00	94320	418.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	36	srednje	zatvoreno	\N
168	63	2026-01-17 09:20:00	2026-01-18 15:20:00	94840	635.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	37	visoko	zatvoreno	\N
169	63	2026-01-29 09:20:00	2026-01-30 15:20:00	95360	492.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	nisko	zatvoreno	\N
170	63	2026-02-10 09:20:00	2026-02-11 15:20:00	95880	529.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	srednje	zatvoreno	\N
171	64	2025-10-27 09:20:00	2025-10-28 15:20:00	94000	199.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	srednje	zatvoreno	\N
172	64	2025-11-08 09:20:00	2025-11-09 15:20:00	94520	236.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	srednje	zatvoreno	\N
173	64	2025-11-20 09:20:00	2025-11-21 15:20:00	95040	273.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	35	nisko	zatvoreno	\N
174	64	2025-12-02 09:20:00	2025-12-03 15:20:00	95560	490.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	36	visoko	zatvoreno	\N
175	64	2025-12-14 09:20:00	2025-12-15 15:20:00	96080	347.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	srednje	zatvoreno	\N
176	64	2025-12-26 09:20:00	2025-12-27 15:20:00	96600	384.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	38	nisko	zatvoreno	\N
177	64	2026-01-07 09:20:00	2026-01-08 15:20:00	97120	421.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	23	srednje	zatvoreno	\N
178	64	2026-01-19 09:20:00	2026-01-20 15:20:00	97640	638.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	24	visoko	zatvoreno	\N
179	64	2026-01-31 09:20:00	2026-02-01 15:20:00	98160	495.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	nisko	zatvoreno	\N
180	64	2026-02-12 09:20:00	2026-02-13 15:20:00	98680	532.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	srednje	zatvoreno	\N
181	65	2025-10-29 09:20:00	2025-10-30 15:20:00	96800	202.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	srednje	zatvoreno	\N
182	65	2025-11-10 09:20:00	2025-11-11 15:20:00	97320	239.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	srednje	zatvoreno	\N
183	65	2025-11-22 09:20:00	2025-11-23 15:20:00	97840	276.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	38	nisko	zatvoreno	\N
184	65	2025-12-04 09:20:00	2025-12-05 15:20:00	98360	493.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	23	visoko	zatvoreno	\N
185	65	2025-12-16 09:20:00	2025-12-17 15:20:00	98880	350.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	srednje	zatvoreno	\N
186	65	2025-12-28 09:20:00	2025-12-29 15:20:00	99400	387.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	25	nisko	zatvoreno	\N
187	65	2026-01-09 09:20:00	2026-01-10 15:20:00	99920	424.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	26	srednje	zatvoreno	\N
188	65	2026-01-21 09:20:00	2026-01-22 15:20:00	100440	641.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	27	visoko	zatvoreno	\N
189	65	2026-02-02 09:20:00	2026-02-03 15:20:00	100960	498.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	nisko	zatvoreno	\N
190	65	2026-02-14 09:20:00	2026-02-15 15:20:00	101480	535.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	srednje	zatvoreno	\N
191	66	2025-10-31 09:20:00	2025-11-01 15:20:00	99600	205.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	srednje	zatvoreno	\N
192	66	2025-11-12 09:20:00	2025-11-13 15:20:00	100120	242.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	srednje	zatvoreno	\N
193	66	2025-11-24 09:20:00	2025-11-25 15:20:00	100640	279.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	25	nisko	zatvoreno	\N
194	66	2025-12-06 09:20:00	2025-12-07 15:20:00	101160	496.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	26	visoko	zatvoreno	\N
195	66	2025-12-18 09:20:00	2025-12-19 15:20:00	101680	353.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	srednje	zatvoreno	\N
196	66	2025-12-30 09:20:00	2025-12-31 15:20:00	102200	390.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	28	nisko	zatvoreno	\N
197	66	2026-01-11 09:20:00	2026-01-12 15:20:00	102720	427.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	29	srednje	zatvoreno	\N
198	66	2026-01-23 09:20:00	2026-01-24 15:20:00	103240	644.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	30	visoko	zatvoreno	\N
199	66	2026-02-04 09:20:00	2026-02-05 15:20:00	103760	501.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	nisko	zatvoreno	\N
200	66	2026-02-16 09:20:00	2026-02-17 15:20:00	104280	538.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	srednje	zatvoreno	\N
201	67	2025-11-02 09:20:00	2025-11-03 15:20:00	102400	208.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	srednje	zatvoreno	\N
202	67	2025-11-14 09:20:00	2025-11-15 15:20:00	102920	245.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	srednje	zatvoreno	\N
203	67	2025-11-26 09:20:00	2025-11-27 15:20:00	103440	282.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	28	nisko	zatvoreno	\N
204	67	2025-12-08 09:20:00	2025-12-09 15:20:00	103960	499.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	29	visoko	zatvoreno	\N
205	67	2025-12-20 09:20:00	2025-12-21 15:20:00	104480	356.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	srednje	zatvoreno	\N
206	67	2026-01-01 09:20:00	2026-01-02 15:20:00	105000	393.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	nisko	zatvoreno	\N
207	67	2026-01-13 09:20:00	2026-01-14 15:20:00	105520	430.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	32	srednje	zatvoreno	\N
208	67	2026-01-25 09:20:00	2026-01-26 15:20:00	106040	647.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	33	visoko	zatvoreno	\N
209	67	2026-02-06 09:20:00	2026-02-07 15:20:00	106560	504.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	nisko	zatvoreno	\N
210	67	2026-02-18 09:20:00	2026-02-19 15:20:00	107080	541.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	35	srednje	zatvoreno	\N
211	68	2025-11-04 09:20:00	2025-11-05 15:20:00	105200	211.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	srednje	zatvoreno	\N
212	68	2025-11-16 09:20:00	2025-11-17 15:20:00	105720	248.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	srednje	zatvoreno	\N
213	68	2025-11-28 09:20:00	2025-11-29 15:20:00	106240	285.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	31	nisko	zatvoreno	\N
214	68	2025-12-10 09:20:00	2025-12-11 15:20:00	106760	502.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	32	visoko	zatvoreno	\N
215	68	2025-12-22 09:20:00	2025-12-23 15:20:00	107280	359.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	srednje	zatvoreno	\N
216	68	2026-01-03 09:20:00	2026-01-04 15:20:00	107800	396.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	nisko	zatvoreno	\N
217	68	2026-01-15 09:20:00	2026-01-16 15:20:00	108320	433.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	35	srednje	zatvoreno	\N
218	68	2026-01-27 09:20:00	2026-01-28 15:20:00	108840	650.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	36	visoko	zatvoreno	\N
219	68	2026-02-08 09:20:00	2026-02-09 15:20:00	109360	507.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	nisko	zatvoreno	\N
220	68	2026-02-20 09:20:00	2026-02-21 15:20:00	109880	544.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	38	srednje	zatvoreno	\N
221	69	2025-11-06 09:20:00	2025-11-07 15:20:00	108000	214.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	srednje	zatvoreno	\N
222	69	2025-11-18 09:20:00	2025-11-19 15:20:00	108520	251.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	srednje	zatvoreno	\N
223	69	2025-11-30 09:20:00	2025-12-01 15:20:00	109040	288.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	34	nisko	zatvoreno	\N
224	69	2025-12-12 09:20:00	2025-12-13 15:20:00	109560	505.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	35	visoko	zatvoreno	\N
225	69	2025-12-24 09:20:00	2025-12-25 15:20:00	110080	362.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	srednje	zatvoreno	\N
226	69	2026-01-05 09:20:00	2026-01-06 15:20:00	110600	399.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	nisko	zatvoreno	\N
227	69	2026-01-17 09:20:00	2026-01-18 15:20:00	111120	436.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	38	srednje	zatvoreno	\N
228	69	2026-01-29 09:20:00	2026-01-30 15:20:00	111640	653.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	23	visoko	zatvoreno	\N
229	69	2026-02-10 09:20:00	2026-02-11 15:20:00	112160	510.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	nisko	zatvoreno	\N
230	69	2026-02-22 09:20:00	2026-02-23 15:20:00	112680	547.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	25	srednje	zatvoreno	\N
231	70	2025-11-08 09:20:00	2025-11-09 15:20:00	110800	217.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	srednje	zatvoreno	\N
232	70	2025-11-20 09:20:00	2025-11-21 15:20:00	111320	254.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	srednje	zatvoreno	\N
233	70	2025-12-02 09:20:00	2025-12-03 15:20:00	111840	291.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	37	nisko	zatvoreno	\N
234	70	2025-12-14 09:20:00	2025-12-15 15:20:00	112360	508.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	38	visoko	zatvoreno	\N
235	70	2025-12-26 09:20:00	2025-12-27 15:20:00	112880	365.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	srednje	zatvoreno	\N
236	70	2026-01-07 09:20:00	2026-01-08 15:20:00	113400	402.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	nisko	zatvoreno	\N
237	70	2026-01-19 09:20:00	2026-01-20 15:20:00	113920	439.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	25	srednje	zatvoreno	\N
238	70	2026-01-31 09:20:00	2026-02-01 15:20:00	114440	656.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	26	visoko	zatvoreno	\N
239	70	2026-02-12 09:20:00	2026-02-13 15:20:00	114960	513.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	nisko	zatvoreno	\N
240	70	2026-02-24 09:20:00	2026-02-25 15:20:00	115480	550.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	28	srednje	zatvoreno	\N
241	71	2025-11-10 09:20:00	2025-11-11 15:20:00	113600	220.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	srednje	zatvoreno	\N
242	71	2025-11-22 09:20:00	2025-11-23 15:20:00	114120	257.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	srednje	zatvoreno	\N
243	71	2025-12-04 09:20:00	2025-12-05 15:20:00	114640	294.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	24	nisko	zatvoreno	\N
244	71	2025-12-16 09:20:00	2025-12-17 15:20:00	115160	511.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	25	visoko	zatvoreno	\N
245	71	2025-12-28 09:20:00	2025-12-29 15:20:00	115680	368.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	srednje	zatvoreno	\N
246	71	2026-01-09 09:20:00	2026-01-10 15:20:00	116200	405.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	nisko	zatvoreno	\N
247	71	2026-01-21 09:20:00	2026-01-22 15:20:00	116720	442.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	28	srednje	zatvoreno	\N
248	71	2026-02-02 09:20:00	2026-02-03 15:20:00	117240	659.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	29	visoko	zatvoreno	\N
249	71	2026-02-14 09:20:00	2026-02-15 15:20:00	117760	516.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	nisko	zatvoreno	\N
250	71	2026-02-26 09:20:00	2026-02-27 15:20:00	118280	553.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	srednje	zatvoreno	\N
251	72	2025-11-12 09:20:00	2025-11-13 15:20:00	116400	223.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	srednje	zatvoreno	\N
252	72	2025-11-24 09:20:00	2025-11-25 15:20:00	116920	260.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	srednje	zatvoreno	\N
253	72	2025-12-06 09:20:00	2025-12-07 15:20:00	117440	297.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	27	nisko	zatvoreno	\N
254	72	2025-12-18 09:20:00	2025-12-19 15:20:00	117960	514.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	28	visoko	zatvoreno	\N
255	72	2025-12-30 09:20:00	2025-12-31 15:20:00	118480	371.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	srednje	zatvoreno	\N
256	72	2026-01-11 09:20:00	2026-01-12 15:20:00	119000	408.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	nisko	zatvoreno	\N
257	72	2026-01-23 09:20:00	2026-01-24 15:20:00	119520	445.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	31	srednje	zatvoreno	\N
258	72	2026-02-04 09:20:00	2026-02-05 15:20:00	120040	662.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	32	visoko	zatvoreno	\N
259	72	2026-02-16 09:20:00	2026-02-17 15:20:00	120560	519.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	nisko	zatvoreno	\N
260	72	2026-02-28 09:20:00	2026-03-01 15:20:00	121080	556.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	srednje	zatvoreno	\N
261	73	2025-11-14 09:20:00	2025-11-15 15:20:00	119200	226.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	srednje	zatvoreno	\N
262	73	2025-11-26 09:20:00	2025-11-27 15:20:00	119720	263.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	srednje	zatvoreno	\N
263	73	2025-12-08 09:20:00	2025-12-09 15:20:00	120240	300.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	30	nisko	zatvoreno	\N
264	73	2025-12-20 09:20:00	2025-12-21 15:20:00	120760	517.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	31	visoko	zatvoreno	\N
265	73	2026-01-01 09:20:00	2026-01-02 15:20:00	121280	374.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	srednje	zatvoreno	\N
266	73	2026-01-13 09:20:00	2026-01-14 15:20:00	121800	411.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	nisko	zatvoreno	\N
267	73	2026-01-25 09:20:00	2026-01-26 15:20:00	122320	448.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	34	srednje	zatvoreno	\N
268	73	2026-02-06 09:20:00	2026-02-07 15:20:00	122840	665.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	35	visoko	zatvoreno	\N
269	73	2026-02-18 09:20:00	2026-02-19 15:20:00	123360	522.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	nisko	zatvoreno	\N
270	73	2026-03-02 09:20:00	2026-03-03 15:20:00	123880	559.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	srednje	zatvoreno	\N
271	74	2025-11-16 09:20:00	2025-11-17 15:20:00	122000	229.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	srednje	zatvoreno	\N
272	74	2025-11-28 09:20:00	2025-11-29 15:20:00	122520	266.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	srednje	zatvoreno	\N
273	74	2025-12-10 09:20:00	2025-12-11 15:20:00	123040	303.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	33	nisko	zatvoreno	\N
274	74	2025-12-22 09:20:00	2025-12-23 15:20:00	123560	520.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	34	visoko	zatvoreno	\N
275	74	2026-01-03 09:20:00	2026-01-04 15:20:00	124080	377.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	srednje	zatvoreno	\N
276	74	2026-01-15 09:20:00	2026-01-16 15:20:00	124600	414.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	nisko	zatvoreno	\N
277	74	2026-01-27 09:20:00	2026-01-28 15:20:00	125120	451.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	37	srednje	zatvoreno	\N
278	74	2026-02-08 09:20:00	2026-02-09 15:20:00	125640	668.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	38	visoko	zatvoreno	\N
279	74	2026-02-20 09:20:00	2026-02-21 15:20:00	126160	525.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	nisko	zatvoreno	\N
280	74	2026-03-04 09:20:00	2026-03-05 15:20:00	126680	562.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	srednje	zatvoreno	\N
281	75	2025-11-18 09:20:00	2025-11-19 15:20:00	124800	232.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	srednje	zatvoreno	\N
282	75	2025-11-30 09:20:00	2025-12-01 15:20:00	125320	269.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	35	srednje	zatvoreno	\N
283	75	2025-12-12 09:20:00	2025-12-13 15:20:00	125840	306.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	36	nisko	zatvoreno	\N
284	75	2025-12-24 09:20:00	2025-12-25 15:20:00	126360	523.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	37	visoko	zatvoreno	\N
285	75	2026-01-05 09:20:00	2026-01-06 15:20:00	126880	380.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	srednje	zatvoreno	\N
286	75	2026-01-17 09:20:00	2026-01-18 15:20:00	127400	417.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	nisko	zatvoreno	\N
287	75	2026-01-29 09:20:00	2026-01-30 15:20:00	127920	454.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	24	srednje	zatvoreno	\N
288	75	2026-02-10 09:20:00	2026-02-11 15:20:00	128440	671.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	25	visoko	zatvoreno	\N
289	75	2026-02-22 09:20:00	2026-02-23 15:20:00	128960	528.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	nisko	zatvoreno	\N
290	75	2026-03-06 09:20:00	2026-03-07 15:20:00	129480	565.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	srednje	zatvoreno	\N
291	76	2025-11-20 09:20:00	2025-11-21 15:20:00	127600	235.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	srednje	zatvoreno	\N
292	76	2025-12-02 09:20:00	2025-12-03 15:20:00	128120	272.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	38	srednje	zatvoreno	\N
293	76	2025-12-14 09:20:00	2025-12-15 15:20:00	128640	309.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	23	nisko	zatvoreno	\N
294	76	2025-12-26 09:20:00	2025-12-27 15:20:00	129160	526.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	24	visoko	zatvoreno	\N
295	76	2026-01-07 09:20:00	2026-01-08 15:20:00	129680	383.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	srednje	zatvoreno	\N
296	76	2026-01-19 09:20:00	2026-01-20 15:20:00	130200	420.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	nisko	zatvoreno	\N
297	76	2026-01-31 09:20:00	2026-02-01 15:20:00	130720	457.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	27	srednje	zatvoreno	\N
298	76	2026-02-12 09:20:00	2026-02-13 15:20:00	131240	674.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	28	visoko	zatvoreno	\N
299	76	2026-02-24 09:20:00	2026-02-25 15:20:00	131760	531.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	nisko	zatvoreno	\N
300	76	2026-03-08 09:20:00	2026-03-09 15:20:00	132280	568.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	srednje	zatvoreno	\N
301	77	2025-11-22 09:20:00	2025-11-23 15:20:00	130400	238.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	srednje	zatvoreno	\N
302	77	2025-12-04 09:20:00	2025-12-05 15:20:00	130920	275.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	25	srednje	zatvoreno	\N
303	77	2025-12-16 09:20:00	2025-12-17 15:20:00	131440	312.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	26	nisko	zatvoreno	\N
304	77	2025-12-28 09:20:00	2025-12-29 15:20:00	131960	529.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	27	visoko	zatvoreno	\N
305	77	2026-01-09 09:20:00	2026-01-10 15:20:00	132480	386.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	srednje	zatvoreno	\N
306	77	2026-01-21 09:20:00	2026-01-22 15:20:00	133000	423.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	nisko	zatvoreno	\N
307	77	2026-02-02 09:20:00	2026-02-03 15:20:00	133520	460.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	30	srednje	zatvoreno	\N
308	77	2026-02-14 09:20:00	2026-02-15 15:20:00	134040	677.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	31	visoko	zatvoreno	\N
309	77	2026-02-26 09:20:00	2026-02-27 15:20:00	134560	534.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	nisko	zatvoreno	\N
310	77	2026-03-10 09:20:00	2026-03-11 15:20:00	135080	571.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	srednje	zatvoreno	\N
311	78	2025-11-24 09:20:00	2025-11-25 15:20:00	133200	241.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	srednje	zatvoreno	\N
312	78	2025-12-06 09:20:00	2025-12-07 15:20:00	133720	278.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	28	srednje	zatvoreno	\N
313	78	2025-12-18 09:20:00	2025-12-19 15:20:00	134240	315.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	29	nisko	zatvoreno	\N
314	78	2025-12-30 09:20:00	2025-12-31 15:20:00	134760	532.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	30	visoko	zatvoreno	\N
315	78	2026-01-11 09:20:00	2026-01-12 15:20:00	135280	389.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	srednje	zatvoreno	\N
316	78	2026-01-23 09:20:00	2026-01-24 15:20:00	135800	426.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	nisko	zatvoreno	\N
317	78	2026-02-04 09:20:00	2026-02-05 15:20:00	136320	463.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	33	srednje	zatvoreno	\N
318	78	2026-02-16 09:20:00	2026-02-17 15:20:00	136840	680.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	34	visoko	zatvoreno	\N
319	78	2026-02-28 09:20:00	2026-03-01 15:20:00	137360	537.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	nisko	zatvoreno	\N
320	78	2026-03-12 09:20:00	2026-03-13 15:20:00	137880	574.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	srednje	zatvoreno	\N
321	79	2025-11-26 09:20:00	2025-11-27 15:20:00	136000	244.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	srednje	zatvoreno	\N
322	79	2025-12-08 09:20:00	2025-12-09 15:20:00	136520	281.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	srednje	zatvoreno	\N
323	79	2025-12-20 09:20:00	2025-12-21 15:20:00	137040	318.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	32	nisko	zatvoreno	\N
324	79	2026-01-01 09:20:00	2026-01-02 15:20:00	137560	535.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	33	visoko	zatvoreno	\N
325	79	2026-01-13 09:20:00	2026-01-14 15:20:00	138080	392.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	srednje	zatvoreno	\N
326	79	2026-01-25 09:20:00	2026-01-26 15:20:00	138600	429.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	35	nisko	zatvoreno	\N
327	79	2026-02-06 09:20:00	2026-02-07 15:20:00	139120	466.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	36	srednje	zatvoreno	\N
328	79	2026-02-18 09:20:00	2026-02-19 15:20:00	139640	683.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	37	visoko	zatvoreno	\N
329	79	2026-03-02 09:20:00	2026-03-03 15:20:00	140160	540.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	nisko	zatvoreno	\N
330	79	2026-03-14 09:20:00	2026-03-15 15:20:00	140680	577.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	srednje	zatvoreno	\N
331	80	2025-11-28 09:20:00	2025-11-29 15:20:00	138800	247.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	srednje	zatvoreno	\N
332	80	2025-12-10 09:20:00	2025-12-11 15:20:00	139320	284.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	srednje	zatvoreno	\N
333	80	2025-12-22 09:20:00	2025-12-23 15:20:00	139840	321.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	35	nisko	zatvoreno	\N
334	80	2026-01-03 09:20:00	2026-01-04 15:20:00	140360	538.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	36	visoko	zatvoreno	\N
335	80	2026-01-15 09:20:00	2026-01-16 15:20:00	140880	395.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	srednje	zatvoreno	\N
336	80	2026-01-27 09:20:00	2026-01-28 15:20:00	141400	432.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	38	nisko	zatvoreno	\N
337	80	2026-02-08 09:20:00	2026-02-09 15:20:00	141920	469.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	23	srednje	zatvoreno	\N
338	80	2026-02-20 09:20:00	2026-02-21 15:20:00	142440	686.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	24	visoko	zatvoreno	\N
339	80	2026-03-04 09:20:00	2026-03-05 15:20:00	142960	543.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	nisko	zatvoreno	\N
340	80	2026-03-16 09:20:00	2026-03-17 15:20:00	143480	580.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	srednje	zatvoreno	\N
341	81	2025-11-30 09:20:00	2025-12-01 15:20:00	141600	250.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	srednje	zatvoreno	\N
342	81	2025-12-12 09:20:00	2025-12-13 15:20:00	142120	287.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	srednje	zatvoreno	\N
343	81	2025-12-24 09:20:00	2025-12-25 15:20:00	142640	324.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	38	nisko	zatvoreno	\N
344	81	2026-01-05 09:20:00	2026-01-06 15:20:00	143160	541.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	23	visoko	zatvoreno	\N
345	81	2026-01-17 09:20:00	2026-01-18 15:20:00	143680	398.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	srednje	zatvoreno	\N
346	81	2026-01-29 09:20:00	2026-01-30 15:20:00	144200	435.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	25	nisko	zatvoreno	\N
347	81	2026-02-10 09:20:00	2026-02-11 15:20:00	144720	472.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	26	srednje	zatvoreno	\N
348	81	2026-02-22 09:20:00	2026-02-23 15:20:00	145240	689.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	27	visoko	zatvoreno	\N
349	81	2026-03-06 09:20:00	2026-03-07 15:20:00	145760	546.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	nisko	zatvoreno	\N
350	81	2026-03-18 09:20:00	2026-03-19 15:20:00	146280	583.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	srednje	zatvoreno	\N
351	82	2025-12-02 09:20:00	2025-12-03 15:20:00	144400	253.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	srednje	zatvoreno	\N
352	82	2025-12-14 09:20:00	2025-12-15 15:20:00	144920	290.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	srednje	zatvoreno	\N
353	82	2025-12-26 09:20:00	2025-12-27 15:20:00	145440	327.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	25	nisko	zatvoreno	\N
354	82	2026-01-07 09:20:00	2026-01-08 15:20:00	145960	544.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	26	visoko	zatvoreno	\N
355	82	2026-01-19 09:20:00	2026-01-20 15:20:00	146480	401.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	srednje	zatvoreno	\N
356	82	2026-01-31 09:20:00	2026-02-01 15:20:00	147000	438.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	28	nisko	zatvoreno	\N
357	82	2026-02-12 09:20:00	2026-02-13 15:20:00	147520	475.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	29	srednje	zatvoreno	\N
358	82	2026-02-24 09:20:00	2026-02-25 15:20:00	148040	692.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	30	visoko	zatvoreno	\N
359	82	2026-03-08 09:20:00	2026-03-09 15:20:00	148560	549.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	nisko	zatvoreno	\N
360	82	2026-03-20 09:20:00	2026-03-21 15:20:00	149080	586.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	srednje	zatvoreno	\N
361	83	2025-12-04 09:20:00	2025-12-05 15:20:00	147200	256.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	srednje	zatvoreno	\N
362	83	2025-12-16 09:20:00	2025-12-17 15:20:00	147720	293.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	srednje	zatvoreno	\N
363	83	2025-12-28 09:20:00	2025-12-29 15:20:00	148240	330.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	28	nisko	zatvoreno	\N
364	83	2026-01-09 09:20:00	2026-01-10 15:20:00	148760	547.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	29	visoko	zatvoreno	\N
365	83	2026-01-21 09:20:00	2026-01-22 15:20:00	149280	404.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	srednje	zatvoreno	\N
366	83	2026-02-02 09:20:00	2026-02-03 15:20:00	149800	441.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	nisko	zatvoreno	\N
367	83	2026-02-14 09:20:00	2026-02-15 15:20:00	150320	478.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	32	srednje	zatvoreno	\N
368	83	2026-02-26 09:20:00	2026-02-27 15:20:00	150840	695.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	33	visoko	zatvoreno	\N
369	83	2026-03-10 09:20:00	2026-03-11 15:20:00	151360	552.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	34	nisko	zatvoreno	\N
370	83	2026-03-22 09:20:00	2026-03-23 15:20:00	151880	589.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	35	srednje	zatvoreno	\N
371	84	2025-12-06 09:20:00	2025-12-07 15:20:00	150000	259.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	srednje	zatvoreno	\N
372	84	2025-12-18 09:20:00	2025-12-19 15:20:00	150520	296.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	srednje	zatvoreno	\N
373	84	2025-12-30 09:20:00	2025-12-31 15:20:00	151040	333.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	31	nisko	zatvoreno	\N
374	84	2026-01-11 09:20:00	2026-01-12 15:20:00	151560	550.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	32	visoko	zatvoreno	\N
375	84	2026-01-23 09:20:00	2026-01-24 15:20:00	152080	407.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	srednje	zatvoreno	\N
376	84	2026-02-04 09:20:00	2026-02-05 15:20:00	152600	444.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	nisko	zatvoreno	\N
377	84	2026-02-16 09:20:00	2026-02-17 15:20:00	153120	481.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	35	srednje	zatvoreno	\N
378	84	2026-02-28 09:20:00	2026-03-01 15:20:00	153640	698.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	36	visoko	zatvoreno	\N
379	84	2026-03-12 09:20:00	2026-03-13 15:20:00	154160	555.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	37	nisko	zatvoreno	\N
380	84	2026-03-24 09:20:00	2026-03-25 15:20:00	154680	592.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	38	srednje	zatvoreno	\N
381	85	2025-12-08 09:20:00	2025-12-09 15:20:00	152800	262.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	srednje	zatvoreno	\N
382	85	2025-12-20 09:20:00	2025-12-21 15:20:00	153320	299.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	srednje	zatvoreno	\N
383	85	2026-01-01 09:20:00	2026-01-02 15:20:00	153840	336.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	34	nisko	zatvoreno	\N
384	85	2026-01-13 09:20:00	2026-01-14 15:20:00	154360	553.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	35	visoko	zatvoreno	\N
385	85	2026-01-25 09:20:00	2026-01-26 15:20:00	154880	410.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	srednje	zatvoreno	\N
386	85	2026-02-06 09:20:00	2026-02-07 15:20:00	155400	447.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	nisko	zatvoreno	\N
387	85	2026-02-18 09:20:00	2026-02-19 15:20:00	155920	484.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	38	srednje	zatvoreno	\N
388	85	2026-03-02 09:20:00	2026-03-03 15:20:00	156440	701.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	23	visoko	zatvoreno	\N
389	85	2026-03-14 09:20:00	2026-03-15 15:20:00	156960	558.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	24	nisko	zatvoreno	\N
390	85	2026-03-26 09:20:00	2026-03-27 15:20:00	157480	595.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	25	srednje	zatvoreno	\N
391	86	2025-12-10 09:20:00	2025-12-11 15:20:00	155600	265.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	srednje	zatvoreno	\N
392	86	2025-12-22 09:20:00	2025-12-23 15:20:00	156120	302.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	srednje	zatvoreno	\N
393	86	2026-01-03 09:20:00	2026-01-04 15:20:00	156640	339.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	37	nisko	zatvoreno	\N
394	86	2026-01-15 09:20:00	2026-01-16 15:20:00	157160	556.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	38	visoko	zatvoreno	\N
395	86	2026-01-27 09:20:00	2026-01-28 15:20:00	157680	413.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	srednje	zatvoreno	\N
396	86	2026-02-08 09:20:00	2026-02-09 15:20:00	158200	450.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	nisko	zatvoreno	\N
397	86	2026-02-20 09:20:00	2026-02-21 15:20:00	158720	487.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	25	srednje	zatvoreno	\N
398	86	2026-03-04 09:20:00	2026-03-05 15:20:00	159240	704.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	26	visoko	zatvoreno	\N
399	86	2026-03-16 09:20:00	2026-03-17 15:20:00	159760	561.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	27	nisko	zatvoreno	\N
400	86	2026-03-28 09:20:00	2026-03-29 15:20:00	160280	598.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	28	srednje	zatvoreno	\N
401	87	2025-12-12 09:20:00	2025-12-13 15:20:00	158400	268.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	38	srednje	zatvoreno	\N
402	87	2025-12-24 09:20:00	2025-12-25 15:20:00	158920	305.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	23	srednje	zatvoreno	\N
403	87	2026-01-05 09:20:00	2026-01-06 15:20:00	159440	342.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	24	nisko	zatvoreno	\N
404	87	2026-01-17 09:20:00	2026-01-18 15:20:00	159960	559.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	25	visoko	zatvoreno	\N
405	87	2026-01-29 09:20:00	2026-01-30 15:20:00	160480	416.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	26	srednje	zatvoreno	\N
406	87	2026-02-10 09:20:00	2026-02-11 15:20:00	161000	453.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	27	nisko	zatvoreno	\N
407	87	2026-02-22 09:20:00	2026-02-23 15:20:00	161520	490.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	28	srednje	zatvoreno	\N
408	87	2026-03-06 09:20:00	2026-03-07 15:20:00	162040	707.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	29	visoko	zatvoreno	\N
409	87	2026-03-18 09:20:00	2026-03-19 15:20:00	162560	564.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	30	nisko	zatvoreno	\N
410	87	2026-03-30 09:20:00	2026-03-31 15:20:00	163080	601.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	31	srednje	zatvoreno	\N
411	88	2025-12-14 09:20:00	2025-12-15 15:20:00	161200	271.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	25	srednje	zatvoreno	\N
412	88	2025-12-26 09:20:00	2025-12-27 15:20:00	161720	308.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	26	srednje	zatvoreno	\N
413	88	2026-01-07 09:20:00	2026-01-08 15:20:00	162240	345.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	27	nisko	zatvoreno	\N
414	88	2026-01-19 09:20:00	2026-01-20 15:20:00	162760	562.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	28	visoko	zatvoreno	\N
415	88	2026-01-31 09:20:00	2026-02-01 15:20:00	163280	419.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	29	srednje	zatvoreno	\N
416	88	2026-02-12 09:20:00	2026-02-13 15:20:00	163800	456.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	30	nisko	zatvoreno	\N
417	88	2026-02-24 09:20:00	2026-02-25 15:20:00	164320	493.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	31	srednje	zatvoreno	\N
418	88	2026-03-08 09:20:00	2026-03-09 15:20:00	164840	710.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	32	visoko	zatvoreno	\N
419	88	2026-03-20 09:20:00	2026-03-21 15:20:00	165360	567.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	33	nisko	zatvoreno	\N
420	88	2026-04-01 09:20:00	2026-04-02 15:20:00	165880	604.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	34	srednje	zatvoreno	\N
421	89	2025-12-16 09:20:00	2025-12-17 15:20:00	164000	274.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	28	srednje	zatvoreno	\N
422	89	2025-12-28 09:20:00	2025-12-29 15:20:00	164520	311.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	29	srednje	zatvoreno	\N
423	89	2026-01-09 09:20:00	2026-01-10 15:20:00	165040	348.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	30	nisko	zatvoreno	\N
424	89	2026-01-21 09:20:00	2026-01-22 15:20:00	165560	565.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	31	visoko	zatvoreno	\N
425	89	2026-02-02 09:20:00	2026-02-03 15:20:00	166080	422.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	5	32	srednje	zatvoreno	\N
426	89	2026-02-14 09:20:00	2026-02-15 15:20:00	166600	459.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	33	nisko	zatvoreno	\N
427	89	2026-02-26 09:20:00	2026-02-27 15:20:00	167120	496.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	34	srednje	zatvoreno	\N
428	89	2026-03-10 09:20:00	2026-03-11 15:20:00	167640	713.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	35	visoko	zatvoreno	\N
429	89	2026-03-22 09:20:00	2026-03-23 15:20:00	168160	570.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	1	36	nisko	zatvoreno	\N
430	89	2026-04-03 09:20:00	2026-04-04 15:20:00	168680	607.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	37	srednje	zatvoreno	\N
431	90	2025-12-18 09:20:00	2025-12-19 15:20:00	166800	277.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	31	srednje	zatvoreno	\N
432	90	2025-12-30 09:20:00	2025-12-31 15:20:00	167320	314.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	32	srednje	zatvoreno	\N
433	90	2026-01-11 09:20:00	2026-01-12 15:20:00	167840	351.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	4	33	nisko	zatvoreno	\N
434	90	2026-01-23 09:20:00	2026-01-24 15:20:00	168360	568.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	34	visoko	zatvoreno	\N
435	90	2026-02-04 09:20:00	2026-02-05 15:20:00	168880	425.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	6	35	srednje	zatvoreno	\N
436	90	2026-02-16 09:20:00	2026-02-17 15:20:00	169400	462.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	7	36	nisko	zatvoreno	\N
437	90	2026-02-28 09:20:00	2026-03-01 15:20:00	169920	499.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	8	37	srednje	zatvoreno	\N
438	90	2026-03-12 09:20:00	2026-03-13 15:20:00	170440	716.00	Odraden veliki servis: filteri, ulje, remenje i detaljna kontrola sustava.	9	38	visoko	zatvoreno	\N
439	90	2026-03-24 09:20:00	2026-03-25 15:20:00	170960	573.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	2	23	nisko	zatvoreno	\N
440	90	2026-04-05 09:20:00	2026-04-06 15:20:00	171480	610.00	Intervencija uspjesno evidentirana i zakljucena bez dodatnih rizika.	3	24	srednje	zatvoreno	\N
\.


--
-- TOC entry 4010 (class 0 OID 20595)
-- Dependencies: 368
-- Data for Name: statusi_vozila; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.statusi_vozila (id, naziv) FROM stdin;
1	Slobodno
2	Na servisu
3	Zauzeto
\.


--
-- TOC entry 4008 (class 0 OID 20589)
-- Dependencies: 366
-- Data for Name: tipovi_goriva; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tipovi_goriva (id, naziv) FROM stdin;
1	Dizel
2	Benzin
\.


--
-- TOC entry 4002 (class 0 OID 20571)
-- Dependencies: 360
-- Data for Name: uloge; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.uloge (id, naziv) FROM stdin;
1	Administrator
3	Zaposlenik
2	Voditelj flote
\.


--
-- TOC entry 4016 (class 0 OID 20630)
-- Dependencies: 374
-- Data for Name: vozila; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vozila (id, model_id, status_id, mjesto_id, broj_sasije, godina_proizvodnje, datum_kupovine, nabavna_vrijednost, trenutna_km, zadnji_mali_servis_km, zadnji_veliki_servis_km, zadnji_mali_servis_datum, zadnji_veliki_servis_datum, is_aktivan, razlog_deaktivacije) FROM stdin;
52	2	2	68	SEEDV000000000002	2018	2018-04-15	14900.00	65320	51400	35600	2025-05-18	2023-10-26	t	\N
53	3	2	60	SEEDV000000000003	2017	2017-04-15	15850.00	68120	54200	35067	2025-05-18	2023-10-26	t	\N
54	4	2	68	SEEDV000000000004	2016	2016-04-15	16800.00	70920	52000	31200	2025-05-18	2023-10-26	t	\N
55	5	1	60	SEEDV000000000005	2020	2020-04-14	17750.00	73720	65667	24000	2025-02-07	2023-10-26	t	\N
56	6	1	68	SEEDV000000000006	2019	2019-04-15	18700.00	76520	70133	36800	2025-02-07	2023-10-26	t	\N
57	7	1	60	SEEDV000000000007	2018	2018-04-15	19650.00	79320	72100	0	2025-10-25	2023-10-26	t	\N
58	8	1	68	SEEDV000000000008	2017	2017-04-15	20600.00	82120	74900	0	2025-10-25	2023-10-26	t	\N
59	9	1	60	SEEDV000000000009	2016	2016-04-15	21550.00	84920	77700	35200	2025-10-25	2020-04-04	t	\N
60	10	1	68	SEEDV000000000010	2020	2020-04-14	22500.00	87720	83000	74667	2025-10-25	2020-04-04	t	\N
61	1	3	60	SEEDV000000000011	2019	2019-04-15	23450.00	90800	83300	57467	2025-10-25	2023-10-26	t	\N
62	2	3	68	SEEDV000000000012	2018	2018-04-15	24400.00	93600	86100	63600	2025-10-25	2023-10-26	t	\N
63	3	3	60	SEEDV000000000013	2017	2017-04-15	25350.00	96400	88900	63067	2025-10-25	2023-10-26	t	\N
64	4	3	68	SEEDV000000000014	2016	2016-04-15	26300.00	99200	89200	59200	2025-10-25	2023-10-26	t	\N
65	5	3	60	SEEDV000000000015	2020	2020-04-14	27250.00	102000	89500	52000	2025-10-25	2023-10-26	t	\N
66	6	3	68	SEEDV000000000016	2019	2019-04-15	28200.00	104800	94800	64800	2025-10-25	2023-10-26	t	\N
67	7	3	60	SEEDV000000000017	2018	2018-04-15	29150.00	107600	100100	67600	2025-10-25	2023-10-26	t	\N
68	8	3	68	SEEDV000000000018	2017	2017-04-15	30100.00	110400	102900	80400	2025-10-25	2023-10-26	t	\N
69	9	1	60	SEEDV000000000019	2016	2016-04-15	31050.00	112920	105700	63200	2025-10-25	2023-10-26	t	\N
70	10	1	68	SEEDV000000000020	2020	2020-04-14	32000.00	115720	111000	102667	2025-10-25	2023-10-26	t	\N
71	1	1	60	SEEDV000000000021	2019	2019-04-15	32950.00	118520	111300	85467	2025-10-25	2023-10-26	t	\N
72	2	1	68	SEEDV000000000022	2018	2018-04-15	33900.00	121320	114100	91600	2025-10-25	2023-10-26	t	\N
73	3	1	60	SEEDV000000000023	2017	2017-04-15	34850.00	124120	116900	91067	2025-10-25	2023-10-26	t	\N
74	4	1	68	SEEDV000000000024	2016	2016-04-15	35800.00	126920	117200	87200	2025-10-25	2023-10-26	t	\N
75	5	1	60	SEEDV000000000025	2020	2020-04-14	36750.00	129720	117500	80000	2025-10-25	2023-10-26	t	\N
76	6	1	68	SEEDV000000000026	2019	2019-04-15	37700.00	132520	122800	92800	2025-10-25	2023-10-26	t	\N
77	7	1	60	SEEDV000000000027	2018	2018-04-15	38650.00	135320	128100	95600	2025-10-25	2023-10-26	t	\N
78	8	1	68	SEEDV000000000028	2017	2017-04-15	39600.00	138120	130900	108400	2025-10-25	2023-10-26	t	\N
79	9	1	60	SEEDV000000000029	2016	2016-04-15	40550.00	140920	133700	91200	2025-10-25	2023-10-26	t	\N
80	10	1	68	SEEDV000000000030	2020	2020-04-14	41500.00	143720	139000	130667	2025-10-25	2023-10-26	t	\N
81	1	1	60	SEEDV000000000031	2019	2019-04-15	42450.00	146520	139300	113467	2025-10-25	2023-10-26	t	\N
82	2	1	68	SEEDV000000000032	2018	2018-04-15	43400.00	149320	142100	119600	2025-10-25	2023-10-26	t	\N
83	3	1	60	SEEDV000000000033	2017	2017-04-15	44350.00	152120	144900	119067	2025-10-25	2023-10-26	t	\N
84	4	1	68	SEEDV000000000034	2016	2016-04-15	45300.00	154920	145200	115200	2025-10-25	2023-10-26	t	\N
85	5	1	60	SEEDV000000000035	2020	2020-04-14	46250.00	157720	145500	108000	2025-10-25	2023-10-26	t	\N
86	6	1	68	SEEDV000000000036	2019	2019-04-15	47200.00	160520	150800	120800	2025-10-25	2023-10-26	t	\N
87	7	1	60	SEEDV000000000037	2018	2018-04-15	48150.00	163320	156100	123600	2025-10-25	2023-10-26	t	\N
88	8	1	68	SEEDV000000000038	2017	2017-04-15	49100.00	166120	158900	136400	2025-10-25	2023-10-26	t	\N
89	9	1	60	SEEDV000000000039	2016	2016-04-15	50050.00	168920	161700	119200	2025-10-25	2023-10-26	t	\N
90	10	1	68	SEEDV000000000040	2020	2020-04-14	51000.00	171720	167000	158667	2025-10-25	2023-10-26	t	\N
51	1	1	60	SEEDV000000000001	2019	2019-04-15	13950.00	62520	48600	29467	2025-05-18	2023-10-26	t	\N
\.


--
-- TOC entry 4020 (class 0 OID 20676)
-- Dependencies: 378
-- Data for Name: zaduzenja; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zaduzenja (id, vozilo_id, zaposlenik_id, datum_od, datum_do, km_pocetna, km_zavrsna, is_aktivno) FROM stdin;
98	51	30	2025-10-01 07:30:00	2025-10-03 13:30:00	53800	54420	f
99	51	31	2025-10-17 07:30:00	2025-10-19 13:30:00	54700	55320	f
100	51	32	2025-11-02 07:30:00	2025-11-04 13:30:00	55600	56220	f
101	51	33	2025-11-18 07:30:00	2025-11-20 13:30:00	56500	57120	f
102	51	34	2025-12-04 07:30:00	2025-12-06 13:30:00	57400	58020	f
103	51	35	2025-12-20 07:30:00	2025-12-22 13:30:00	58300	58920	f
104	51	36	2026-01-05 07:30:00	2026-01-07 13:30:00	59200	59820	f
105	51	37	2026-01-21 07:30:00	2026-01-23 13:30:00	60100	60720	f
106	51	38	2026-02-06 07:30:00	2026-02-08 13:30:00	61000	61620	f
107	51	23	2026-02-22 07:30:00	2026-02-24 13:30:00	61900	62520	f
108	52	37	2025-10-02 07:30:00	2025-10-04 13:30:00	56600	57220	f
109	52	38	2025-10-18 07:30:00	2025-10-20 13:30:00	57500	58120	f
110	52	23	2025-11-03 07:30:00	2025-11-05 13:30:00	58400	59020	f
111	52	24	2025-11-19 07:30:00	2025-11-21 13:30:00	59300	59920	f
112	52	25	2025-12-05 07:30:00	2025-12-07 13:30:00	60200	60820	f
113	52	26	2025-12-21 07:30:00	2025-12-23 13:30:00	61100	61720	f
114	52	27	2026-01-06 07:30:00	2026-01-08 13:30:00	62000	62620	f
115	52	28	2026-01-22 07:30:00	2026-01-24 13:30:00	62900	63520	f
116	52	29	2026-02-07 07:30:00	2026-02-09 13:30:00	63800	64420	f
117	52	30	2026-02-23 07:30:00	2026-02-25 13:30:00	64700	65320	f
118	53	28	2025-10-03 07:30:00	2025-10-05 13:30:00	59400	60020	f
119	53	29	2025-10-19 07:30:00	2025-10-21 13:30:00	60300	60920	f
120	53	30	2025-11-04 07:30:00	2025-11-06 13:30:00	61200	61820	f
121	53	31	2025-11-20 07:30:00	2025-11-22 13:30:00	62100	62720	f
122	53	32	2025-12-06 07:30:00	2025-12-08 13:30:00	63000	63620	f
123	53	33	2025-12-22 07:30:00	2025-12-24 13:30:00	63900	64520	f
124	53	34	2026-01-07 07:30:00	2026-01-09 13:30:00	64800	65420	f
125	53	35	2026-01-23 07:30:00	2026-01-25 13:30:00	65700	66320	f
126	53	36	2026-02-08 07:30:00	2026-02-10 13:30:00	66600	67220	f
127	53	37	2026-02-24 07:30:00	2026-02-26 13:30:00	67500	68120	f
128	54	35	2025-10-04 07:30:00	2025-10-06 13:30:00	62200	62820	f
129	54	36	2025-10-20 07:30:00	2025-10-22 13:30:00	63100	63720	f
130	54	37	2025-11-05 07:30:00	2025-11-07 13:30:00	64000	64620	f
131	54	38	2025-11-21 07:30:00	2025-11-23 13:30:00	64900	65520	f
132	54	23	2025-12-07 07:30:00	2025-12-09 13:30:00	65800	66420	f
133	54	24	2025-12-23 07:30:00	2025-12-25 13:30:00	66700	67320	f
134	54	25	2026-01-08 07:30:00	2026-01-10 13:30:00	67600	68220	f
135	54	26	2026-01-24 07:30:00	2026-01-26 13:30:00	68500	69120	f
136	54	27	2026-02-09 07:30:00	2026-02-11 13:30:00	69400	70020	f
137	54	28	2026-02-25 07:30:00	2026-02-27 13:30:00	70300	70920	f
138	55	26	2025-10-05 07:30:00	2025-10-07 13:30:00	65000	65620	f
139	55	27	2025-10-21 07:30:00	2025-10-23 13:30:00	65900	66520	f
140	55	28	2025-11-06 07:30:00	2025-11-08 13:30:00	66800	67420	f
141	55	29	2025-11-22 07:30:00	2025-11-24 13:30:00	67700	68320	f
142	55	30	2025-12-08 07:30:00	2025-12-10 13:30:00	68600	69220	f
143	55	31	2025-12-24 07:30:00	2025-12-26 13:30:00	69500	70120	f
144	55	32	2026-01-09 07:30:00	2026-01-11 13:30:00	70400	71020	f
145	55	33	2026-01-25 07:30:00	2026-01-27 13:30:00	71300	71920	f
146	55	34	2026-02-10 07:30:00	2026-02-12 13:30:00	72200	72820	f
147	55	35	2026-02-26 07:30:00	2026-02-28 13:30:00	73100	73720	f
148	56	33	2025-10-06 07:30:00	2025-10-08 13:30:00	67800	68420	f
149	56	34	2025-10-22 07:30:00	2025-10-24 13:30:00	68700	69320	f
150	56	35	2025-11-07 07:30:00	2025-11-09 13:30:00	69600	70220	f
151	56	36	2025-11-23 07:30:00	2025-11-25 13:30:00	70500	71120	f
152	56	37	2025-12-09 07:30:00	2025-12-11 13:30:00	71400	72020	f
153	56	38	2025-12-25 07:30:00	2025-12-27 13:30:00	72300	72920	f
154	56	23	2026-01-10 07:30:00	2026-01-12 13:30:00	73200	73820	f
155	56	24	2026-01-26 07:30:00	2026-01-28 13:30:00	74100	74720	f
156	56	25	2026-02-11 07:30:00	2026-02-13 13:30:00	75000	75620	f
157	56	26	2026-02-27 07:30:00	2026-03-01 13:30:00	75900	76520	f
158	57	24	2025-10-07 07:30:00	2025-10-09 13:30:00	70600	71220	f
159	57	25	2025-10-23 07:30:00	2025-10-25 13:30:00	71500	72120	f
160	57	26	2025-11-08 07:30:00	2025-11-10 13:30:00	72400	73020	f
161	57	27	2025-11-24 07:30:00	2025-11-26 13:30:00	73300	73920	f
162	57	28	2025-12-10 07:30:00	2025-12-12 13:30:00	74200	74820	f
163	57	29	2025-12-26 07:30:00	2025-12-28 13:30:00	75100	75720	f
164	57	30	2026-01-11 07:30:00	2026-01-13 13:30:00	76000	76620	f
165	57	31	2026-01-27 07:30:00	2026-01-29 13:30:00	76900	77520	f
166	57	32	2026-02-12 07:30:00	2026-02-14 13:30:00	77800	78420	f
167	57	33	2026-02-28 07:30:00	2026-03-02 13:30:00	78700	79320	f
168	58	31	2025-10-08 07:30:00	2025-10-10 13:30:00	73400	74020	f
169	58	32	2025-10-24 07:30:00	2025-10-26 13:30:00	74300	74920	f
170	58	33	2025-11-09 07:30:00	2025-11-11 13:30:00	75200	75820	f
171	58	34	2025-11-25 07:30:00	2025-11-27 13:30:00	76100	76720	f
172	58	35	2025-12-11 07:30:00	2025-12-13 13:30:00	77000	77620	f
173	58	36	2025-12-27 07:30:00	2025-12-29 13:30:00	77900	78520	f
174	58	37	2026-01-12 07:30:00	2026-01-14 13:30:00	78800	79420	f
175	58	38	2026-01-28 07:30:00	2026-01-30 13:30:00	79700	80320	f
176	58	23	2026-02-13 07:30:00	2026-02-15 13:30:00	80600	81220	f
177	58	24	2026-03-01 07:30:00	2026-03-03 13:30:00	81500	82120	f
178	59	38	2025-10-09 07:30:00	2025-10-11 13:30:00	76200	76820	f
179	59	23	2025-10-25 07:30:00	2025-10-27 13:30:00	77100	77720	f
180	59	24	2025-11-10 07:30:00	2025-11-12 13:30:00	78000	78620	f
181	59	25	2025-11-26 07:30:00	2025-11-28 13:30:00	78900	79520	f
182	59	26	2025-12-12 07:30:00	2025-12-14 13:30:00	79800	80420	f
183	59	27	2025-12-28 07:30:00	2025-12-30 13:30:00	80700	81320	f
184	59	28	2026-01-13 07:30:00	2026-01-15 13:30:00	81600	82220	f
185	59	29	2026-01-29 07:30:00	2026-01-31 13:30:00	82500	83120	f
186	59	30	2026-02-14 07:30:00	2026-02-16 13:30:00	83400	84020	f
187	59	31	2026-03-02 07:30:00	2026-03-04 13:30:00	84300	84920	f
188	60	29	2025-10-10 07:30:00	2025-10-12 13:30:00	79000	79620	f
189	60	30	2025-10-26 07:30:00	2025-10-28 13:30:00	79900	80520	f
190	60	31	2025-11-11 07:30:00	2025-11-13 13:30:00	80800	81420	f
191	60	32	2025-11-27 07:30:00	2025-11-29 13:30:00	81700	82320	f
192	60	33	2025-12-13 07:30:00	2025-12-15 13:30:00	82600	83220	f
193	60	34	2025-12-29 07:30:00	2025-12-31 13:30:00	83500	84120	f
194	60	35	2026-01-14 07:30:00	2026-01-16 13:30:00	84400	85020	f
195	60	36	2026-01-30 07:30:00	2026-02-01 13:30:00	85300	85920	f
196	60	37	2026-02-15 07:30:00	2026-02-17 13:30:00	86200	86820	f
197	60	38	2026-03-03 07:30:00	2026-03-05 13:30:00	87100	87720	f
198	61	36	2025-10-11 07:30:00	2025-10-13 13:30:00	81800	82420	f
199	61	37	2025-10-27 07:30:00	2025-10-29 13:30:00	82700	83320	f
200	61	38	2025-11-12 07:30:00	2025-11-14 13:30:00	83600	84220	f
201	61	23	2025-11-28 07:30:00	2025-11-30 13:30:00	84500	85120	f
202	61	24	2025-12-14 07:30:00	2025-12-16 13:30:00	85400	86020	f
203	61	25	2025-12-30 07:30:00	2026-01-01 13:30:00	86300	86920	f
204	61	26	2026-01-15 07:30:00	2026-01-17 13:30:00	87200	87820	f
205	61	27	2026-01-31 07:30:00	2026-02-02 13:30:00	88100	88720	f
206	61	28	2026-02-16 07:30:00	2026-02-18 13:30:00	89000	89620	f
207	61	29	2026-03-04 07:30:00	\N	89900	90800	t
208	62	27	2025-10-12 07:30:00	2025-10-14 13:30:00	84600	85220	f
209	62	28	2025-10-28 07:30:00	2025-10-30 13:30:00	85500	86120	f
210	62	29	2025-11-13 07:30:00	2025-11-15 13:30:00	86400	87020	f
211	62	30	2025-11-29 07:30:00	2025-12-01 13:30:00	87300	87920	f
212	62	31	2025-12-15 07:30:00	2025-12-17 13:30:00	88200	88820	f
213	62	32	2025-12-31 07:30:00	2026-01-02 13:30:00	89100	89720	f
214	62	33	2026-01-16 07:30:00	2026-01-18 13:30:00	90000	90620	f
215	62	34	2026-02-01 07:30:00	2026-02-03 13:30:00	90900	91520	f
216	62	35	2026-02-17 07:30:00	2026-02-19 13:30:00	91800	92420	f
217	62	36	2026-03-05 07:30:00	\N	92700	93600	t
218	63	34	2025-10-13 07:30:00	2025-10-15 13:30:00	87400	88020	f
219	63	35	2025-10-29 07:30:00	2025-10-31 13:30:00	88300	88920	f
220	63	36	2025-11-14 07:30:00	2025-11-16 13:30:00	89200	89820	f
221	63	37	2025-11-30 07:30:00	2025-12-02 13:30:00	90100	90720	f
222	63	38	2025-12-16 07:30:00	2025-12-18 13:30:00	91000	91620	f
223	63	23	2026-01-01 07:30:00	2026-01-03 13:30:00	91900	92520	f
224	63	24	2026-01-17 07:30:00	2026-01-19 13:30:00	92800	93420	f
225	63	25	2026-02-02 07:30:00	2026-02-04 13:30:00	93700	94320	f
226	63	26	2026-02-18 07:30:00	2026-02-20 13:30:00	94600	95220	f
227	63	27	2026-03-06 07:30:00	\N	95500	96400	t
228	64	25	2025-10-14 07:30:00	2025-10-16 13:30:00	90200	90820	f
229	64	26	2025-10-30 07:30:00	2025-11-01 13:30:00	91100	91720	f
230	64	27	2025-11-15 07:30:00	2025-11-17 13:30:00	92000	92620	f
231	64	28	2025-12-01 07:30:00	2025-12-03 13:30:00	92900	93520	f
232	64	29	2025-12-17 07:30:00	2025-12-19 13:30:00	93800	94420	f
233	64	30	2026-01-02 07:30:00	2026-01-04 13:30:00	94700	95320	f
234	64	31	2026-01-18 07:30:00	2026-01-20 13:30:00	95600	96220	f
235	64	32	2026-02-03 07:30:00	2026-02-05 13:30:00	96500	97120	f
236	64	33	2026-02-19 07:30:00	2026-02-21 13:30:00	97400	98020	f
237	64	34	2026-03-07 07:30:00	\N	98300	99200	t
238	65	32	2025-10-15 07:30:00	2025-10-17 13:30:00	93000	93620	f
239	65	33	2025-10-31 07:30:00	2025-11-02 13:30:00	93900	94520	f
240	65	34	2025-11-16 07:30:00	2025-11-18 13:30:00	94800	95420	f
241	65	35	2025-12-02 07:30:00	2025-12-04 13:30:00	95700	96320	f
242	65	36	2025-12-18 07:30:00	2025-12-20 13:30:00	96600	97220	f
243	65	37	2026-01-03 07:30:00	2026-01-05 13:30:00	97500	98120	f
244	65	38	2026-01-19 07:30:00	2026-01-21 13:30:00	98400	99020	f
245	65	23	2026-02-04 07:30:00	2026-02-06 13:30:00	99300	99920	f
246	65	24	2026-02-20 07:30:00	2026-02-22 13:30:00	100200	100820	f
247	65	25	2026-03-08 07:30:00	\N	101100	102000	t
248	66	23	2025-10-16 07:30:00	2025-10-18 13:30:00	95800	96420	f
249	66	24	2025-11-01 07:30:00	2025-11-03 13:30:00	96700	97320	f
250	66	25	2025-11-17 07:30:00	2025-11-19 13:30:00	97600	98220	f
251	66	26	2025-12-03 07:30:00	2025-12-05 13:30:00	98500	99120	f
252	66	27	2025-12-19 07:30:00	2025-12-21 13:30:00	99400	100020	f
253	66	28	2026-01-04 07:30:00	2026-01-06 13:30:00	100300	100920	f
254	66	29	2026-01-20 07:30:00	2026-01-22 13:30:00	101200	101820	f
255	66	30	2026-02-05 07:30:00	2026-02-07 13:30:00	102100	102720	f
256	66	31	2026-02-21 07:30:00	2026-02-23 13:30:00	103000	103620	f
257	66	32	2026-03-09 07:30:00	\N	103900	104800	t
258	67	30	2025-10-17 07:30:00	2025-10-19 13:30:00	98600	99220	f
259	67	31	2025-11-02 07:30:00	2025-11-04 13:30:00	99500	100120	f
260	67	32	2025-11-18 07:30:00	2025-11-20 13:30:00	100400	101020	f
261	67	33	2025-12-04 07:30:00	2025-12-06 13:30:00	101300	101920	f
262	67	34	2025-12-20 07:30:00	2025-12-22 13:30:00	102200	102820	f
263	67	35	2026-01-05 07:30:00	2026-01-07 13:30:00	103100	103720	f
264	67	36	2026-01-21 07:30:00	2026-01-23 13:30:00	104000	104620	f
265	67	37	2026-02-06 07:30:00	2026-02-08 13:30:00	104900	105520	f
266	67	38	2026-02-22 07:30:00	2026-02-24 13:30:00	105800	106420	f
267	67	23	2026-03-10 07:30:00	\N	106700	107600	t
268	68	37	2025-10-18 07:30:00	2025-10-20 13:30:00	101400	102020	f
269	68	38	2025-11-03 07:30:00	2025-11-05 13:30:00	102300	102920	f
270	68	23	2025-11-19 07:30:00	2025-11-21 13:30:00	103200	103820	f
271	68	24	2025-12-05 07:30:00	2025-12-07 13:30:00	104100	104720	f
272	68	25	2025-12-21 07:30:00	2025-12-23 13:30:00	105000	105620	f
273	68	26	2026-01-06 07:30:00	2026-01-08 13:30:00	105900	106520	f
274	68	27	2026-01-22 07:30:00	2026-01-24 13:30:00	106800	107420	f
275	68	28	2026-02-07 07:30:00	2026-02-09 13:30:00	107700	108320	f
276	68	29	2026-02-23 07:30:00	2026-02-25 13:30:00	108600	109220	f
277	68	30	2026-03-11 07:30:00	\N	109500	110400	t
278	69	28	2025-10-19 07:30:00	2025-10-21 13:30:00	104200	104820	f
279	69	29	2025-11-04 07:30:00	2025-11-06 13:30:00	105100	105720	f
280	69	30	2025-11-20 07:30:00	2025-11-22 13:30:00	106000	106620	f
281	69	31	2025-12-06 07:30:00	2025-12-08 13:30:00	106900	107520	f
282	69	32	2025-12-22 07:30:00	2025-12-24 13:30:00	107800	108420	f
283	69	33	2026-01-07 07:30:00	2026-01-09 13:30:00	108700	109320	f
284	69	34	2026-01-23 07:30:00	2026-01-25 13:30:00	109600	110220	f
285	69	35	2026-02-08 07:30:00	2026-02-10 13:30:00	110500	111120	f
286	69	36	2026-02-24 07:30:00	2026-02-26 13:30:00	111400	112020	f
287	69	37	2026-03-12 07:30:00	2026-03-14 13:30:00	112300	112920	f
288	70	35	2025-10-20 07:30:00	2025-10-22 13:30:00	107000	107620	f
289	70	36	2025-11-05 07:30:00	2025-11-07 13:30:00	107900	108520	f
290	70	37	2025-11-21 07:30:00	2025-11-23 13:30:00	108800	109420	f
291	70	38	2025-12-07 07:30:00	2025-12-09 13:30:00	109700	110320	f
292	70	23	2025-12-23 07:30:00	2025-12-25 13:30:00	110600	111220	f
293	70	24	2026-01-08 07:30:00	2026-01-10 13:30:00	111500	112120	f
294	70	25	2026-01-24 07:30:00	2026-01-26 13:30:00	112400	113020	f
295	70	26	2026-02-09 07:30:00	2026-02-11 13:30:00	113300	113920	f
296	70	27	2026-02-25 07:30:00	2026-02-27 13:30:00	114200	114820	f
297	70	28	2026-03-13 07:30:00	2026-03-15 13:30:00	115100	115720	f
298	71	26	2025-10-21 07:30:00	2025-10-23 13:30:00	109800	110420	f
299	71	27	2025-11-06 07:30:00	2025-11-08 13:30:00	110700	111320	f
300	71	28	2025-11-22 07:30:00	2025-11-24 13:30:00	111600	112220	f
301	71	29	2025-12-08 07:30:00	2025-12-10 13:30:00	112500	113120	f
302	71	30	2025-12-24 07:30:00	2025-12-26 13:30:00	113400	114020	f
303	71	31	2026-01-09 07:30:00	2026-01-11 13:30:00	114300	114920	f
304	71	32	2026-01-25 07:30:00	2026-01-27 13:30:00	115200	115820	f
305	71	33	2026-02-10 07:30:00	2026-02-12 13:30:00	116100	116720	f
306	71	34	2026-02-26 07:30:00	2026-02-28 13:30:00	117000	117620	f
307	71	35	2026-03-14 07:30:00	2026-03-16 13:30:00	117900	118520	f
308	72	33	2025-10-22 07:30:00	2025-10-24 13:30:00	112600	113220	f
309	72	34	2025-11-07 07:30:00	2025-11-09 13:30:00	113500	114120	f
310	72	35	2025-11-23 07:30:00	2025-11-25 13:30:00	114400	115020	f
311	72	36	2025-12-09 07:30:00	2025-12-11 13:30:00	115300	115920	f
312	72	37	2025-12-25 07:30:00	2025-12-27 13:30:00	116200	116820	f
313	72	38	2026-01-10 07:30:00	2026-01-12 13:30:00	117100	117720	f
314	72	23	2026-01-26 07:30:00	2026-01-28 13:30:00	118000	118620	f
315	72	24	2026-02-11 07:30:00	2026-02-13 13:30:00	118900	119520	f
316	72	25	2026-02-27 07:30:00	2026-03-01 13:30:00	119800	120420	f
317	72	26	2026-03-15 07:30:00	2026-03-17 13:30:00	120700	121320	f
318	73	24	2025-10-23 07:30:00	2025-10-25 13:30:00	115400	116020	f
319	73	25	2025-11-08 07:30:00	2025-11-10 13:30:00	116300	116920	f
320	73	26	2025-11-24 07:30:00	2025-11-26 13:30:00	117200	117820	f
321	73	27	2025-12-10 07:30:00	2025-12-12 13:30:00	118100	118720	f
322	73	28	2025-12-26 07:30:00	2025-12-28 13:30:00	119000	119620	f
323	73	29	2026-01-11 07:30:00	2026-01-13 13:30:00	119900	120520	f
324	73	30	2026-01-27 07:30:00	2026-01-29 13:30:00	120800	121420	f
325	73	31	2026-02-12 07:30:00	2026-02-14 13:30:00	121700	122320	f
326	73	32	2026-02-28 07:30:00	2026-03-02 13:30:00	122600	123220	f
327	73	33	2026-03-16 07:30:00	2026-03-18 13:30:00	123500	124120	f
328	74	31	2025-10-24 07:30:00	2025-10-26 13:30:00	118200	118820	f
329	74	32	2025-11-09 07:30:00	2025-11-11 13:30:00	119100	119720	f
330	74	33	2025-11-25 07:30:00	2025-11-27 13:30:00	120000	120620	f
331	74	34	2025-12-11 07:30:00	2025-12-13 13:30:00	120900	121520	f
332	74	35	2025-12-27 07:30:00	2025-12-29 13:30:00	121800	122420	f
333	74	36	2026-01-12 07:30:00	2026-01-14 13:30:00	122700	123320	f
334	74	37	2026-01-28 07:30:00	2026-01-30 13:30:00	123600	124220	f
335	74	38	2026-02-13 07:30:00	2026-02-15 13:30:00	124500	125120	f
336	74	23	2026-03-01 07:30:00	2026-03-03 13:30:00	125400	126020	f
337	74	24	2026-03-17 07:30:00	2026-03-19 13:30:00	126300	126920	f
338	75	38	2025-10-25 07:30:00	2025-10-27 13:30:00	121000	121620	f
339	75	23	2025-11-10 07:30:00	2025-11-12 13:30:00	121900	122520	f
340	75	24	2025-11-26 07:30:00	2025-11-28 13:30:00	122800	123420	f
341	75	25	2025-12-12 07:30:00	2025-12-14 13:30:00	123700	124320	f
342	75	26	2025-12-28 07:30:00	2025-12-30 13:30:00	124600	125220	f
343	75	27	2026-01-13 07:30:00	2026-01-15 13:30:00	125500	126120	f
344	75	28	2026-01-29 07:30:00	2026-01-31 13:30:00	126400	127020	f
345	75	29	2026-02-14 07:30:00	2026-02-16 13:30:00	127300	127920	f
346	75	30	2026-03-02 07:30:00	2026-03-04 13:30:00	128200	128820	f
347	75	31	2026-03-18 07:30:00	2026-03-20 13:30:00	129100	129720	f
348	76	29	2025-10-26 07:30:00	2025-10-28 13:30:00	123800	124420	f
349	76	30	2025-11-11 07:30:00	2025-11-13 13:30:00	124700	125320	f
350	76	31	2025-11-27 07:30:00	2025-11-29 13:30:00	125600	126220	f
351	76	32	2025-12-13 07:30:00	2025-12-15 13:30:00	126500	127120	f
352	76	33	2025-12-29 07:30:00	2025-12-31 13:30:00	127400	128020	f
353	76	34	2026-01-14 07:30:00	2026-01-16 13:30:00	128300	128920	f
354	76	35	2026-01-30 07:30:00	2026-02-01 13:30:00	129200	129820	f
355	76	36	2026-02-15 07:30:00	2026-02-17 13:30:00	130100	130720	f
356	76	37	2026-03-03 07:30:00	2026-03-05 13:30:00	131000	131620	f
357	76	38	2026-03-19 07:30:00	2026-03-21 13:30:00	131900	132520	f
358	77	36	2025-10-27 07:30:00	2025-10-29 13:30:00	126600	127220	f
359	77	37	2025-11-12 07:30:00	2025-11-14 13:30:00	127500	128120	f
360	77	38	2025-11-28 07:30:00	2025-11-30 13:30:00	128400	129020	f
361	77	23	2025-12-14 07:30:00	2025-12-16 13:30:00	129300	129920	f
362	77	24	2025-12-30 07:30:00	2026-01-01 13:30:00	130200	130820	f
363	77	25	2026-01-15 07:30:00	2026-01-17 13:30:00	131100	131720	f
364	77	26	2026-01-31 07:30:00	2026-02-02 13:30:00	132000	132620	f
365	77	27	2026-02-16 07:30:00	2026-02-18 13:30:00	132900	133520	f
366	77	28	2026-03-04 07:30:00	2026-03-06 13:30:00	133800	134420	f
367	77	29	2026-03-20 07:30:00	2026-03-22 13:30:00	134700	135320	f
368	78	27	2025-10-28 07:30:00	2025-10-30 13:30:00	129400	130020	f
369	78	28	2025-11-13 07:30:00	2025-11-15 13:30:00	130300	130920	f
370	78	29	2025-11-29 07:30:00	2025-12-01 13:30:00	131200	131820	f
371	78	30	2025-12-15 07:30:00	2025-12-17 13:30:00	132100	132720	f
372	78	31	2025-12-31 07:30:00	2026-01-02 13:30:00	133000	133620	f
373	78	32	2026-01-16 07:30:00	2026-01-18 13:30:00	133900	134520	f
374	78	33	2026-02-01 07:30:00	2026-02-03 13:30:00	134800	135420	f
375	78	34	2026-02-17 07:30:00	2026-02-19 13:30:00	135700	136320	f
376	78	35	2026-03-05 07:30:00	2026-03-07 13:30:00	136600	137220	f
377	78	36	2026-03-21 07:30:00	2026-03-23 13:30:00	137500	138120	f
378	79	34	2025-10-29 07:30:00	2025-10-31 13:30:00	132200	132820	f
379	79	35	2025-11-14 07:30:00	2025-11-16 13:30:00	133100	133720	f
380	79	36	2025-11-30 07:30:00	2025-12-02 13:30:00	134000	134620	f
381	79	37	2025-12-16 07:30:00	2025-12-18 13:30:00	134900	135520	f
382	79	38	2026-01-01 07:30:00	2026-01-03 13:30:00	135800	136420	f
383	79	23	2026-01-17 07:30:00	2026-01-19 13:30:00	136700	137320	f
384	79	24	2026-02-02 07:30:00	2026-02-04 13:30:00	137600	138220	f
385	79	25	2026-02-18 07:30:00	2026-02-20 13:30:00	138500	139120	f
386	79	26	2026-03-06 07:30:00	2026-03-08 13:30:00	139400	140020	f
387	79	27	2026-03-22 07:30:00	2026-03-24 13:30:00	140300	140920	f
388	80	25	2025-10-30 07:30:00	2025-11-01 13:30:00	135000	135620	f
389	80	26	2025-11-15 07:30:00	2025-11-17 13:30:00	135900	136520	f
390	80	27	2025-12-01 07:30:00	2025-12-03 13:30:00	136800	137420	f
391	80	28	2025-12-17 07:30:00	2025-12-19 13:30:00	137700	138320	f
392	80	29	2026-01-02 07:30:00	2026-01-04 13:30:00	138600	139220	f
393	80	30	2026-01-18 07:30:00	2026-01-20 13:30:00	139500	140120	f
394	80	31	2026-02-03 07:30:00	2026-02-05 13:30:00	140400	141020	f
395	80	32	2026-02-19 07:30:00	2026-02-21 13:30:00	141300	141920	f
396	80	33	2026-03-07 07:30:00	2026-03-09 13:30:00	142200	142820	f
397	80	34	2026-03-23 07:30:00	2026-03-25 13:30:00	143100	143720	f
398	81	32	2025-10-31 07:30:00	2025-11-02 13:30:00	137800	138420	f
399	81	33	2025-11-16 07:30:00	2025-11-18 13:30:00	138700	139320	f
400	81	34	2025-12-02 07:30:00	2025-12-04 13:30:00	139600	140220	f
401	81	35	2025-12-18 07:30:00	2025-12-20 13:30:00	140500	141120	f
402	81	36	2026-01-03 07:30:00	2026-01-05 13:30:00	141400	142020	f
403	81	37	2026-01-19 07:30:00	2026-01-21 13:30:00	142300	142920	f
404	81	38	2026-02-04 07:30:00	2026-02-06 13:30:00	143200	143820	f
405	81	23	2026-02-20 07:30:00	2026-02-22 13:30:00	144100	144720	f
406	81	24	2026-03-08 07:30:00	2026-03-10 13:30:00	145000	145620	f
407	81	25	2026-03-24 07:30:00	2026-03-26 13:30:00	145900	146520	f
408	82	23	2025-11-01 07:30:00	2025-11-03 13:30:00	140600	141220	f
409	82	24	2025-11-17 07:30:00	2025-11-19 13:30:00	141500	142120	f
410	82	25	2025-12-03 07:30:00	2025-12-05 13:30:00	142400	143020	f
411	82	26	2025-12-19 07:30:00	2025-12-21 13:30:00	143300	143920	f
412	82	27	2026-01-04 07:30:00	2026-01-06 13:30:00	144200	144820	f
413	82	28	2026-01-20 07:30:00	2026-01-22 13:30:00	145100	145720	f
414	82	29	2026-02-05 07:30:00	2026-02-07 13:30:00	146000	146620	f
415	82	30	2026-02-21 07:30:00	2026-02-23 13:30:00	146900	147520	f
416	82	31	2026-03-09 07:30:00	2026-03-11 13:30:00	147800	148420	f
417	82	32	2026-03-25 07:30:00	2026-03-27 13:30:00	148700	149320	f
418	83	30	2025-11-02 07:30:00	2025-11-04 13:30:00	143400	144020	f
419	83	31	2025-11-18 07:30:00	2025-11-20 13:30:00	144300	144920	f
420	83	32	2025-12-04 07:30:00	2025-12-06 13:30:00	145200	145820	f
421	83	33	2025-12-20 07:30:00	2025-12-22 13:30:00	146100	146720	f
422	83	34	2026-01-05 07:30:00	2026-01-07 13:30:00	147000	147620	f
423	83	35	2026-01-21 07:30:00	2026-01-23 13:30:00	147900	148520	f
424	83	36	2026-02-06 07:30:00	2026-02-08 13:30:00	148800	149420	f
425	83	37	2026-02-22 07:30:00	2026-02-24 13:30:00	149700	150320	f
426	83	38	2026-03-10 07:30:00	2026-03-12 13:30:00	150600	151220	f
427	83	23	2026-03-26 07:30:00	2026-03-28 13:30:00	151500	152120	f
428	84	37	2025-11-03 07:30:00	2025-11-05 13:30:00	146200	146820	f
429	84	38	2025-11-19 07:30:00	2025-11-21 13:30:00	147100	147720	f
430	84	23	2025-12-05 07:30:00	2025-12-07 13:30:00	148000	148620	f
431	84	24	2025-12-21 07:30:00	2025-12-23 13:30:00	148900	149520	f
432	84	25	2026-01-06 07:30:00	2026-01-08 13:30:00	149800	150420	f
433	84	26	2026-01-22 07:30:00	2026-01-24 13:30:00	150700	151320	f
434	84	27	2026-02-07 07:30:00	2026-02-09 13:30:00	151600	152220	f
435	84	28	2026-02-23 07:30:00	2026-02-25 13:30:00	152500	153120	f
436	84	29	2026-03-11 07:30:00	2026-03-13 13:30:00	153400	154020	f
437	84	30	2026-03-27 07:30:00	2026-03-29 13:30:00	154300	154920	f
438	85	28	2025-11-04 07:30:00	2025-11-06 13:30:00	149000	149620	f
439	85	29	2025-11-20 07:30:00	2025-11-22 13:30:00	149900	150520	f
440	85	30	2025-12-06 07:30:00	2025-12-08 13:30:00	150800	151420	f
441	85	31	2025-12-22 07:30:00	2025-12-24 13:30:00	151700	152320	f
442	85	32	2026-01-07 07:30:00	2026-01-09 13:30:00	152600	153220	f
443	85	33	2026-01-23 07:30:00	2026-01-25 13:30:00	153500	154120	f
444	85	34	2026-02-08 07:30:00	2026-02-10 13:30:00	154400	155020	f
445	85	35	2026-02-24 07:30:00	2026-02-26 13:30:00	155300	155920	f
446	85	36	2026-03-12 07:30:00	2026-03-14 13:30:00	156200	156820	f
447	85	37	2026-03-28 07:30:00	2026-03-30 13:30:00	157100	157720	f
448	86	35	2025-11-05 07:30:00	2025-11-07 13:30:00	151800	152420	f
449	86	36	2025-11-21 07:30:00	2025-11-23 13:30:00	152700	153320	f
450	86	37	2025-12-07 07:30:00	2025-12-09 13:30:00	153600	154220	f
451	86	38	2025-12-23 07:30:00	2025-12-25 13:30:00	154500	155120	f
452	86	23	2026-01-08 07:30:00	2026-01-10 13:30:00	155400	156020	f
453	86	24	2026-01-24 07:30:00	2026-01-26 13:30:00	156300	156920	f
454	86	25	2026-02-09 07:30:00	2026-02-11 13:30:00	157200	157820	f
455	86	26	2026-02-25 07:30:00	2026-02-27 13:30:00	158100	158720	f
456	86	27	2026-03-13 07:30:00	2026-03-15 13:30:00	159000	159620	f
457	86	28	2026-03-29 07:30:00	2026-03-31 13:30:00	159900	160520	f
458	87	26	2025-11-06 07:30:00	2025-11-08 13:30:00	154600	155220	f
459	87	27	2025-11-22 07:30:00	2025-11-24 13:30:00	155500	156120	f
460	87	28	2025-12-08 07:30:00	2025-12-10 13:30:00	156400	157020	f
461	87	29	2025-12-24 07:30:00	2025-12-26 13:30:00	157300	157920	f
462	87	30	2026-01-09 07:30:00	2026-01-11 13:30:00	158200	158820	f
463	87	31	2026-01-25 07:30:00	2026-01-27 13:30:00	159100	159720	f
464	87	32	2026-02-10 07:30:00	2026-02-12 13:30:00	160000	160620	f
465	87	33	2026-02-26 07:30:00	2026-02-28 13:30:00	160900	161520	f
466	87	34	2026-03-14 07:30:00	2026-03-16 13:30:00	161800	162420	f
467	87	35	2026-03-30 07:30:00	2026-04-01 13:30:00	162700	163320	f
468	88	33	2025-11-07 07:30:00	2025-11-09 13:30:00	157400	158020	f
469	88	34	2025-11-23 07:30:00	2025-11-25 13:30:00	158300	158920	f
470	88	35	2025-12-09 07:30:00	2025-12-11 13:30:00	159200	159820	f
471	88	36	2025-12-25 07:30:00	2025-12-27 13:30:00	160100	160720	f
472	88	37	2026-01-10 07:30:00	2026-01-12 13:30:00	161000	161620	f
473	88	38	2026-01-26 07:30:00	2026-01-28 13:30:00	161900	162520	f
474	88	23	2026-02-11 07:30:00	2026-02-13 13:30:00	162800	163420	f
475	88	24	2026-02-27 07:30:00	2026-03-01 13:30:00	163700	164320	f
476	88	25	2026-03-15 07:30:00	2026-03-17 13:30:00	164600	165220	f
477	88	26	2026-03-31 07:30:00	2026-04-02 13:30:00	165500	166120	f
478	89	24	2025-11-08 07:30:00	2025-11-10 13:30:00	160200	160820	f
479	89	25	2025-11-24 07:30:00	2025-11-26 13:30:00	161100	161720	f
480	89	26	2025-12-10 07:30:00	2025-12-12 13:30:00	162000	162620	f
481	89	27	2025-12-26 07:30:00	2025-12-28 13:30:00	162900	163520	f
482	89	28	2026-01-11 07:30:00	2026-01-13 13:30:00	163800	164420	f
483	89	29	2026-01-27 07:30:00	2026-01-29 13:30:00	164700	165320	f
484	89	30	2026-02-12 07:30:00	2026-02-14 13:30:00	165600	166220	f
485	89	31	2026-02-28 07:30:00	2026-03-02 13:30:00	166500	167120	f
486	89	32	2026-03-16 07:30:00	2026-03-18 13:30:00	167400	168020	f
487	89	33	2026-04-01 07:30:00	2026-04-03 13:30:00	168300	168920	f
488	90	31	2025-11-09 07:30:00	2025-11-11 13:30:00	163000	163620	f
489	90	32	2025-11-25 07:30:00	2025-11-27 13:30:00	163900	164520	f
490	90	33	2025-12-11 07:30:00	2025-12-13 13:30:00	164800	165420	f
491	90	34	2025-12-27 07:30:00	2025-12-29 13:30:00	165700	166320	f
492	90	35	2026-01-12 07:30:00	2026-01-14 13:30:00	166600	167220	f
493	90	36	2026-01-28 07:30:00	2026-01-30 13:30:00	167500	168120	f
494	90	37	2026-02-13 07:30:00	2026-02-15 13:30:00	168400	169020	f
495	90	38	2026-03-01 07:30:00	2026-03-03 13:30:00	169300	169920	f
496	90	23	2026-03-17 07:30:00	2026-03-19 13:30:00	170200	170820	f
497	90	24	2026-04-02 07:30:00	2026-04-04 13:30:00	171100	171720	f
\.


--
-- TOC entry 4018 (class 0 OID 20656)
-- Dependencies: 376
-- Data for Name: zaposlenici; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zaposlenici (id, ime, prezime, korisnicko_ime, lozinka, uloga_id, mjesto_id, email, pozivnica_token, pozivnica_vrijedi_do, is_aktivan, razlog_deaktivacije) FROM stdin;
23	Marko	Barisic	seed.radnik01	Test1234!	3	60	seed.radnik01@carlytics.test	\N	\N	t	\N
24	Ivan	Mikulic	seed.radnik02	Test1234!	3	68	seed.radnik02@carlytics.test	\N	\N	t	\N
25	Luka	Peric	seed.radnik03	Test1234!	3	60	seed.radnik03@carlytics.test	\N	\N	t	\N
26	Petar	Ristic	seed.radnik04	Test1234!	3	68	seed.radnik04@carlytics.test	\N	\N	t	\N
27	Ante	Kovacevic	seed.radnik05	Test1234!	3	60	seed.radnik05@carlytics.test	\N	\N	t	\N
28	Nikola	Babic	seed.radnik06	Test1234!	3	68	seed.radnik06@carlytics.test	\N	\N	t	\N
29	Josip	Knezovic	seed.radnik07	Test1234!	3	60	seed.radnik07@carlytics.test	\N	\N	t	\N
30	Marin	Zovko	seed.radnik08	Test1234!	3	68	seed.radnik08@carlytics.test	\N	\N	t	\N
31	Dario	Boric	seed.radnik09	Test1234!	3	60	seed.radnik09@carlytics.test	\N	\N	t	\N
32	Bruno	Puljic	seed.radnik10	Test1234!	3	68	seed.radnik10@carlytics.test	\N	\N	t	\N
33	Toni	Jelavic	seed.radnik11	Test1234!	3	60	seed.radnik11@carlytics.test	\N	\N	t	\N
34	Igor	Matic	seed.radnik12	Test1234!	3	68	seed.radnik12@carlytics.test	\N	\N	t	\N
35	Mario	Lovric	seed.radnik13	Test1234!	3	60	seed.radnik13@carlytics.test	\N	\N	t	\N
36	Stipe	Prskalo	seed.radnik14	Test1234!	3	68	seed.radnik14@carlytics.test	\N	\N	t	\N
37	Filip	Coric	seed.radnik15	Test1234!	3	60	seed.radnik15@carlytics.test	\N	\N	t	\N
38	Domagoj	Mandic	seed.radnik16	Test1234!	3	68	seed.radnik16@carlytics.test	\N	\N	t	\N
39	Tomislav	Soldo	seed.voditelj01	Test1234!	2	60	seed.voditelj01@carlytics.test	\N	\N	t	\N
40	Dalibor	Maric	seed.voditelj02	Test1234!	2	68	seed.voditelj02@carlytics.test	\N	\N	t	\N
41	Ivan	Brkic	seed.admin01	Test1234!	1	60	seed.admin01@carlytics.test	\N	\N	t	\N
42	Mladen	Knez	seed.admin02	Test1234!	1	68	seed.admin02@carlytics.test	\N	\N	t	\N
43	Demo	Administrator	seed.admin03	Test1234!	1	60	seed.admin03@carlytics.test	\N	\N	t	\N
44	Portfolio	Admin	seed.admin04	Test1234!	1	68	seed.admin04@carlytics.test	\N	\N	t	\N
\.


--
-- TOC entry 3998 (class 0 OID 20549)
-- Dependencies: 356
-- Data for Name: zupanije; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.zupanije (id, naziv, drzava_id) FROM stdin;
11	Regija Banja Luka	1
12	Regija Doboj	1
13	Regija Istočno Sarajevo	1
14	Regija Trebinje	1
15	Brčko distrikt	1
16	Regija Prijedor	1
17	Regija Bijeljina	1
1	Unsko-sanska županija	1
2	Posavska županija	1
3	Tuzlanska županija	1
4	Zeničko-dobojska županija	1
5	Bosansko-podrinjska županija	1
6	Srednjobosanska županija	1
7	Hercegovačko-neretvanska županija	1
8	Zapadnohercegovačka županija	1
10	Hercegbosanska županija	1
9	Županija Sarajevo	1
\.


--
-- TOC entry 4076 (class 0 OID 0)
-- Dependencies: 387
-- Name: app_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.app_events_id_seq', 1742, true);


--
-- TOC entry 4077 (class 0 OID 0)
-- Dependencies: 353
-- Name: drzave_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.drzave_id_seq', 1, true);


--
-- TOC entry 4078 (class 0 OID 0)
-- Dependencies: 383
-- Name: evidencija_goriva_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.evidencija_goriva_id_seq', 448, true);


--
-- TOC entry 4079 (class 0 OID 0)
-- Dependencies: 385
-- Name: evidencija_guma_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.evidencija_guma_id_seq', 188, true);


--
-- TOC entry 4080 (class 0 OID 0)
-- Dependencies: 369
-- Name: kategorije_kvarova_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kategorije_kvarova_id_seq', 10, true);


--
-- TOC entry 4081 (class 0 OID 0)
-- Dependencies: 363
-- Name: kategorije_vozila_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kategorije_vozila_id_seq', 3, true);


--
-- TOC entry 4082 (class 0 OID 0)
-- Dependencies: 357
-- Name: mjesta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.mjesta_id_seq', 143, true);


--
-- TOC entry 4083 (class 0 OID 0)
-- Dependencies: 371
-- Name: modeli_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.modeli_id_seq', 10, true);


--
-- TOC entry 4084 (class 0 OID 0)
-- Dependencies: 361
-- Name: proizvodjaci_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.proizvodjaci_id_seq', 6, true);


--
-- TOC entry 4085 (class 0 OID 0)
-- Dependencies: 379
-- Name: registracije_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.registracije_id_seq', 212, true);


--
-- TOC entry 4086 (class 0 OID 0)
-- Dependencies: 381
-- Name: servisne_intervencije_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.servisne_intervencije_id_seq', 440, true);


--
-- TOC entry 4087 (class 0 OID 0)
-- Dependencies: 367
-- Name: statusi_vozila_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.statusi_vozila_id_seq', 4, true);


--
-- TOC entry 4088 (class 0 OID 0)
-- Dependencies: 365
-- Name: tipovi_goriva_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tipovi_goriva_id_seq', 2, true);


--
-- TOC entry 4089 (class 0 OID 0)
-- Dependencies: 359
-- Name: uloge_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.uloge_id_seq', 3, true);


--
-- TOC entry 4090 (class 0 OID 0)
-- Dependencies: 373
-- Name: vozila_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vozila_id_seq', 90, true);


--
-- TOC entry 4091 (class 0 OID 0)
-- Dependencies: 377
-- Name: zaduzenja_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zaduzenja_id_seq', 497, true);


--
-- TOC entry 4092 (class 0 OID 0)
-- Dependencies: 375
-- Name: zaposlenici_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zaposlenici_id_seq', 44, true);


--
-- TOC entry 4093 (class 0 OID 0)
-- Dependencies: 355
-- Name: zupanije_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.zupanije_id_seq', 5, true);


--
-- TOC entry 3802 (class 2606 OID 23335)
-- Name: app_events app_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_events
    ADD CONSTRAINT app_events_pkey PRIMARY KEY (id);


--
-- TOC entry 3757 (class 2606 OID 20547)
-- Name: drzave drzave_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drzave
    ADD CONSTRAINT drzave_pkey PRIMARY KEY (id);


--
-- TOC entry 3797 (class 2606 OID 20740)
-- Name: evidencija_goriva evidencija_goriva_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencija_goriva
    ADD CONSTRAINT evidencija_goriva_pkey PRIMARY KEY (id);


--
-- TOC entry 3799 (class 2606 OID 20752)
-- Name: evidencija_guma evidencija_guma_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencija_guma
    ADD CONSTRAINT evidencija_guma_pkey PRIMARY KEY (id);


--
-- TOC entry 3773 (class 2606 OID 20605)
-- Name: kategorije_kvarova kategorije_kvarova_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kategorije_kvarova
    ADD CONSTRAINT kategorije_kvarova_pkey PRIMARY KEY (id);


--
-- TOC entry 3767 (class 2606 OID 20587)
-- Name: kategorije_vozila kategorije_vozila_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kategorije_vozila
    ADD CONSTRAINT kategorije_vozila_pkey PRIMARY KEY (id);


--
-- TOC entry 3761 (class 2606 OID 20564)
-- Name: mjesta mjesta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mjesta
    ADD CONSTRAINT mjesta_pkey PRIMARY KEY (id);


--
-- TOC entry 3775 (class 2606 OID 20613)
-- Name: modeli modeli_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modeli
    ADD CONSTRAINT modeli_pkey PRIMARY KEY (id);


--
-- TOC entry 3765 (class 2606 OID 20581)
-- Name: proizvodjaci proizvodjaci_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proizvodjaci
    ADD CONSTRAINT proizvodjaci_pkey PRIMARY KEY (id);


--
-- TOC entry 3792 (class 2606 OID 20698)
-- Name: registracije registracije_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registracije
    ADD CONSTRAINT registracije_pkey PRIMARY KEY (id);


--
-- TOC entry 3795 (class 2606 OID 20712)
-- Name: servisne_intervencije servisne_intervencije_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servisne_intervencije
    ADD CONSTRAINT servisne_intervencije_pkey PRIMARY KEY (id);


--
-- TOC entry 3771 (class 2606 OID 20599)
-- Name: statusi_vozila statusi_vozila_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.statusi_vozila
    ADD CONSTRAINT statusi_vozila_pkey PRIMARY KEY (id);


--
-- TOC entry 3769 (class 2606 OID 20593)
-- Name: tipovi_goriva tipovi_goriva_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tipovi_goriva
    ADD CONSTRAINT tipovi_goriva_pkey PRIMARY KEY (id);


--
-- TOC entry 3763 (class 2606 OID 20575)
-- Name: uloge uloge_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uloge
    ADD CONSTRAINT uloge_pkey PRIMARY KEY (id);


--
-- TOC entry 3777 (class 2606 OID 20639)
-- Name: vozila vozila_broj_sasije_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vozila
    ADD CONSTRAINT vozila_broj_sasije_key UNIQUE (broj_sasije);


--
-- TOC entry 3779 (class 2606 OID 20637)
-- Name: vozila vozila_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vozila
    ADD CONSTRAINT vozila_pkey PRIMARY KEY (id);


--
-- TOC entry 3790 (class 2606 OID 20682)
-- Name: zaduzenja zaduzenja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaduzenja
    ADD CONSTRAINT zaduzenja_pkey PRIMARY KEY (id);


--
-- TOC entry 3782 (class 2606 OID 23353)
-- Name: zaposlenici zaposlenici_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaposlenici
    ADD CONSTRAINT zaposlenici_email_key UNIQUE (email);


--
-- TOC entry 3784 (class 2606 OID 20664)
-- Name: zaposlenici zaposlenici_korisnicko_ime_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaposlenici
    ADD CONSTRAINT zaposlenici_korisnicko_ime_key UNIQUE (korisnicko_ime);


--
-- TOC entry 3786 (class 2606 OID 20662)
-- Name: zaposlenici zaposlenici_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaposlenici
    ADD CONSTRAINT zaposlenici_pkey PRIMARY KEY (id);


--
-- TOC entry 3788 (class 2606 OID 23355)
-- Name: zaposlenici zaposlenici_pozivnica_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaposlenici
    ADD CONSTRAINT zaposlenici_pozivnica_token_key UNIQUE (pozivnica_token);


--
-- TOC entry 3759 (class 2606 OID 20553)
-- Name: zupanije zupanije_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zupanije
    ADD CONSTRAINT zupanije_pkey PRIMARY KEY (id);


--
-- TOC entry 3800 (class 1259 OID 23336)
-- Name: app_events_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX app_events_created_at_idx ON public.app_events USING btree (kreirano_u DESC);


--
-- TOC entry 3803 (class 1259 OID 23337)
-- Name: app_events_source_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX app_events_source_created_idx ON public.app_events USING btree (izvorna_tablica, kreirano_u DESC);


--
-- TOC entry 3793 (class 1259 OID 24495)
-- Name: idx_servis_kategorija; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_servis_kategorija ON public.servisne_intervencije USING btree (kategorija_id);


--
-- TOC entry 3780 (class 1259 OID 23357)
-- Name: idx_zaposlenici_aktivan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_zaposlenici_aktivan ON public.zaposlenici USING btree (is_aktivan);


--
-- TOC entry 3824 (class 2620 OID 23340)
-- Name: evidencija_goriva trg_emit_app_event_evidencija_goriva; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_emit_app_event_evidencija_goriva AFTER INSERT OR DELETE OR UPDATE ON public.evidencija_goriva FOR EACH ROW EXECUTE FUNCTION public.emit_app_event();


--
-- TOC entry 3822 (class 2620 OID 23342)
-- Name: zaduzenja trg_emit_app_event_zaduzenja; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_emit_app_event_zaduzenja AFTER INSERT OR DELETE OR UPDATE ON public.zaduzenja FOR EACH ROW EXECUTE FUNCTION public.emit_app_event();


--
-- TOC entry 3823 (class 2620 OID 24504)
-- Name: servisne_intervencije trg_servisne_intervencije_event; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_servisne_intervencije_event AFTER INSERT OR UPDATE ON public.servisne_intervencije FOR EACH ROW EXECUTE FUNCTION public.emit_app_event();


--
-- TOC entry 3820 (class 2606 OID 20741)
-- Name: evidencija_goriva evidencija_goriva_zaduzenje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencija_goriva
    ADD CONSTRAINT evidencija_goriva_zaduzenje_id_fkey FOREIGN KEY (zaduzenje_id) REFERENCES public.zaduzenja(id);


--
-- TOC entry 3821 (class 2606 OID 20753)
-- Name: evidencija_guma evidencija_guma_vozilo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidencija_guma
    ADD CONSTRAINT evidencija_guma_vozilo_id_fkey FOREIGN KEY (vozilo_id) REFERENCES public.vozila(id);


--
-- TOC entry 3805 (class 2606 OID 20565)
-- Name: mjesta mjesta_zupanija_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mjesta
    ADD CONSTRAINT mjesta_zupanija_id_fkey FOREIGN KEY (zupanija_id) REFERENCES public.zupanije(id);


--
-- TOC entry 3806 (class 2606 OID 20619)
-- Name: modeli modeli_kategorija_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modeli
    ADD CONSTRAINT modeli_kategorija_id_fkey FOREIGN KEY (kategorija_id) REFERENCES public.kategorije_vozila(id);


--
-- TOC entry 3807 (class 2606 OID 20614)
-- Name: modeli modeli_proizvodjac_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modeli
    ADD CONSTRAINT modeli_proizvodjac_id_fkey FOREIGN KEY (proizvodjac_id) REFERENCES public.proizvodjaci(id);


--
-- TOC entry 3808 (class 2606 OID 20624)
-- Name: modeli modeli_tip_goriva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modeli
    ADD CONSTRAINT modeli_tip_goriva_id_fkey FOREIGN KEY (tip_goriva_id) REFERENCES public.tipovi_goriva(id);


--
-- TOC entry 3816 (class 2606 OID 20699)
-- Name: registracije registracije_vozilo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registracije
    ADD CONSTRAINT registracije_vozilo_id_fkey FOREIGN KEY (vozilo_id) REFERENCES public.vozila(id);


--
-- TOC entry 3817 (class 2606 OID 24490)
-- Name: servisne_intervencije servisne_intervencije_kategorija_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servisne_intervencije
    ADD CONSTRAINT servisne_intervencije_kategorija_id_fkey FOREIGN KEY (kategorija_id) REFERENCES public.kategorije_kvarova(id);


--
-- TOC entry 3818 (class 2606 OID 20713)
-- Name: servisne_intervencije servisne_intervencije_vozilo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servisne_intervencije
    ADD CONSTRAINT servisne_intervencije_vozilo_id_fkey FOREIGN KEY (vozilo_id) REFERENCES public.vozila(id);


--
-- TOC entry 3819 (class 2606 OID 24497)
-- Name: servisne_intervencije servisne_intervencije_zaposlenik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servisne_intervencije
    ADD CONSTRAINT servisne_intervencije_zaposlenik_id_fkey FOREIGN KEY (zaposlenik_id) REFERENCES public.zaposlenici(id);


--
-- TOC entry 3809 (class 2606 OID 20650)
-- Name: vozila vozila_mjesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vozila
    ADD CONSTRAINT vozila_mjesto_id_fkey FOREIGN KEY (mjesto_id) REFERENCES public.mjesta(id);


--
-- TOC entry 3810 (class 2606 OID 20640)
-- Name: vozila vozila_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vozila
    ADD CONSTRAINT vozila_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.modeli(id);


--
-- TOC entry 3811 (class 2606 OID 20645)
-- Name: vozila vozila_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vozila
    ADD CONSTRAINT vozila_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.statusi_vozila(id);


--
-- TOC entry 3814 (class 2606 OID 20683)
-- Name: zaduzenja zaduzenja_vozilo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaduzenja
    ADD CONSTRAINT zaduzenja_vozilo_id_fkey FOREIGN KEY (vozilo_id) REFERENCES public.vozila(id);


--
-- TOC entry 3815 (class 2606 OID 20688)
-- Name: zaduzenja zaduzenja_zaposlenik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaduzenja
    ADD CONSTRAINT zaduzenja_zaposlenik_id_fkey FOREIGN KEY (zaposlenik_id) REFERENCES public.zaposlenici(id);


--
-- TOC entry 3812 (class 2606 OID 20670)
-- Name: zaposlenici zaposlenici_mjesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaposlenici
    ADD CONSTRAINT zaposlenici_mjesto_id_fkey FOREIGN KEY (mjesto_id) REFERENCES public.mjesta(id);


--
-- TOC entry 3813 (class 2606 OID 20665)
-- Name: zaposlenici zaposlenici_uloga_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zaposlenici
    ADD CONSTRAINT zaposlenici_uloga_id_fkey FOREIGN KEY (uloga_id) REFERENCES public.uloge(id);


--
-- TOC entry 3804 (class 2606 OID 20554)
-- Name: zupanije zupanije_drzava_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zupanije
    ADD CONSTRAINT zupanije_drzava_id_fkey FOREIGN KEY (drzava_id) REFERENCES public.drzave(id);


--
-- TOC entry 3990 (class 0 OID 23325)
-- Dependencies: 388
-- Name: app_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3991 (class 3256 OID 23338)
-- Name: app_events app_events_select_realtime; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_events_select_realtime ON public.app_events FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 3973 (class 0 OID 20543)
-- Dependencies: 354
-- Name: drzave; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.drzave ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3988 (class 0 OID 20734)
-- Dependencies: 384
-- Name: evidencija_goriva; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.evidencija_goriva ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3989 (class 0 OID 20747)
-- Dependencies: 386
-- Name: evidencija_guma; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.evidencija_guma ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3981 (class 0 OID 20601)
-- Dependencies: 370
-- Name: kategorije_kvarova; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kategorije_kvarova ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3978 (class 0 OID 20583)
-- Dependencies: 364
-- Name: kategorije_vozila; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kategorije_vozila ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3975 (class 0 OID 20560)
-- Dependencies: 358
-- Name: mjesta; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mjesta ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3982 (class 0 OID 20607)
-- Dependencies: 372
-- Name: modeli; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.modeli ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3977 (class 0 OID 20577)
-- Dependencies: 362
-- Name: proizvodjaci; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.proizvodjaci ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3986 (class 0 OID 20694)
-- Dependencies: 380
-- Name: registracije; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.registracije ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3987 (class 0 OID 20705)
-- Dependencies: 382
-- Name: servisne_intervencije; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.servisne_intervencije ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3980 (class 0 OID 20595)
-- Dependencies: 368
-- Name: statusi_vozila; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.statusi_vozila ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3979 (class 0 OID 20589)
-- Dependencies: 366
-- Name: tipovi_goriva; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tipovi_goriva ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3976 (class 0 OID 20571)
-- Dependencies: 360
-- Name: uloge; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.uloge ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3983 (class 0 OID 20630)
-- Dependencies: 374
-- Name: vozila; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vozila ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3985 (class 0 OID 20676)
-- Dependencies: 378
-- Name: zaduzenja; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.zaduzenja ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3984 (class 0 OID 20656)
-- Dependencies: 376
-- Name: zaposlenici; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.zaposlenici ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3974 (class 0 OID 20549)
-- Dependencies: 356
-- Name: zupanije; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.zupanije ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4037 (class 0 OID 0)
-- Dependencies: 97
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- TOC entry 4038 (class 0 OID 0)
-- Dependencies: 506
-- Name: FUNCTION emit_app_event(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.emit_app_event() TO anon;
GRANT ALL ON FUNCTION public.emit_app_event() TO authenticated;
GRANT ALL ON FUNCTION public.emit_app_event() TO service_role;


--
-- TOC entry 4039 (class 0 OID 0)
-- Dependencies: 479
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- TOC entry 4040 (class 0 OID 0)
-- Dependencies: 388
-- Name: TABLE app_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.app_events TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.app_events TO authenticated;
GRANT ALL ON TABLE public.app_events TO service_role;


--
-- TOC entry 4041 (class 0 OID 0)
-- Dependencies: 387
-- Name: SEQUENCE app_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.app_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.app_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.app_events_id_seq TO service_role;


--
-- TOC entry 4042 (class 0 OID 0)
-- Dependencies: 354
-- Name: TABLE drzave; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.drzave TO anon;
GRANT ALL ON TABLE public.drzave TO authenticated;
GRANT ALL ON TABLE public.drzave TO service_role;


--
-- TOC entry 4043 (class 0 OID 0)
-- Dependencies: 353
-- Name: SEQUENCE drzave_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.drzave_id_seq TO anon;
GRANT ALL ON SEQUENCE public.drzave_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.drzave_id_seq TO service_role;


--
-- TOC entry 4044 (class 0 OID 0)
-- Dependencies: 384
-- Name: TABLE evidencija_goriva; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.evidencija_goriva TO anon;
GRANT ALL ON TABLE public.evidencija_goriva TO authenticated;
GRANT ALL ON TABLE public.evidencija_goriva TO service_role;


--
-- TOC entry 4045 (class 0 OID 0)
-- Dependencies: 383
-- Name: SEQUENCE evidencija_goriva_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.evidencija_goriva_id_seq TO anon;
GRANT ALL ON SEQUENCE public.evidencija_goriva_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.evidencija_goriva_id_seq TO service_role;


--
-- TOC entry 4046 (class 0 OID 0)
-- Dependencies: 386
-- Name: TABLE evidencija_guma; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.evidencija_guma TO anon;
GRANT ALL ON TABLE public.evidencija_guma TO authenticated;
GRANT ALL ON TABLE public.evidencija_guma TO service_role;


--
-- TOC entry 4047 (class 0 OID 0)
-- Dependencies: 385
-- Name: SEQUENCE evidencija_guma_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.evidencija_guma_id_seq TO anon;
GRANT ALL ON SEQUENCE public.evidencija_guma_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.evidencija_guma_id_seq TO service_role;


--
-- TOC entry 4048 (class 0 OID 0)
-- Dependencies: 370
-- Name: TABLE kategorije_kvarova; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kategorije_kvarova TO anon;
GRANT ALL ON TABLE public.kategorije_kvarova TO authenticated;
GRANT ALL ON TABLE public.kategorije_kvarova TO service_role;


--
-- TOC entry 4049 (class 0 OID 0)
-- Dependencies: 369
-- Name: SEQUENCE kategorije_kvarova_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.kategorije_kvarova_id_seq TO anon;
GRANT ALL ON SEQUENCE public.kategorije_kvarova_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.kategorije_kvarova_id_seq TO service_role;


--
-- TOC entry 4050 (class 0 OID 0)
-- Dependencies: 364
-- Name: TABLE kategorije_vozila; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kategorije_vozila TO anon;
GRANT ALL ON TABLE public.kategorije_vozila TO authenticated;
GRANT ALL ON TABLE public.kategorije_vozila TO service_role;


--
-- TOC entry 4051 (class 0 OID 0)
-- Dependencies: 363
-- Name: SEQUENCE kategorije_vozila_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.kategorije_vozila_id_seq TO anon;
GRANT ALL ON SEQUENCE public.kategorije_vozila_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.kategorije_vozila_id_seq TO service_role;


--
-- TOC entry 4052 (class 0 OID 0)
-- Dependencies: 358
-- Name: TABLE mjesta; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mjesta TO anon;
GRANT ALL ON TABLE public.mjesta TO authenticated;
GRANT ALL ON TABLE public.mjesta TO service_role;


--
-- TOC entry 4053 (class 0 OID 0)
-- Dependencies: 357
-- Name: SEQUENCE mjesta_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mjesta_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mjesta_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mjesta_id_seq TO service_role;


--
-- TOC entry 4054 (class 0 OID 0)
-- Dependencies: 372
-- Name: TABLE modeli; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.modeli TO anon;
GRANT ALL ON TABLE public.modeli TO authenticated;
GRANT ALL ON TABLE public.modeli TO service_role;


--
-- TOC entry 4055 (class 0 OID 0)
-- Dependencies: 371
-- Name: SEQUENCE modeli_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.modeli_id_seq TO anon;
GRANT ALL ON SEQUENCE public.modeli_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.modeli_id_seq TO service_role;


--
-- TOC entry 4056 (class 0 OID 0)
-- Dependencies: 362
-- Name: TABLE proizvodjaci; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.proizvodjaci TO anon;
GRANT ALL ON TABLE public.proizvodjaci TO authenticated;
GRANT ALL ON TABLE public.proizvodjaci TO service_role;


--
-- TOC entry 4057 (class 0 OID 0)
-- Dependencies: 361
-- Name: SEQUENCE proizvodjaci_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.proizvodjaci_id_seq TO anon;
GRANT ALL ON SEQUENCE public.proizvodjaci_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.proizvodjaci_id_seq TO service_role;


--
-- TOC entry 4058 (class 0 OID 0)
-- Dependencies: 380
-- Name: TABLE registracije; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.registracije TO anon;
GRANT ALL ON TABLE public.registracije TO authenticated;
GRANT ALL ON TABLE public.registracije TO service_role;


--
-- TOC entry 4059 (class 0 OID 0)
-- Dependencies: 379
-- Name: SEQUENCE registracije_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.registracije_id_seq TO anon;
GRANT ALL ON SEQUENCE public.registracije_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.registracije_id_seq TO service_role;


--
-- TOC entry 4060 (class 0 OID 0)
-- Dependencies: 382
-- Name: TABLE servisne_intervencije; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.servisne_intervencije TO anon;
GRANT ALL ON TABLE public.servisne_intervencije TO authenticated;
GRANT ALL ON TABLE public.servisne_intervencije TO service_role;


--
-- TOC entry 4061 (class 0 OID 0)
-- Dependencies: 381
-- Name: SEQUENCE servisne_intervencije_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.servisne_intervencije_id_seq TO anon;
GRANT ALL ON SEQUENCE public.servisne_intervencije_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.servisne_intervencije_id_seq TO service_role;


--
-- TOC entry 4062 (class 0 OID 0)
-- Dependencies: 368
-- Name: TABLE statusi_vozila; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.statusi_vozila TO anon;
GRANT ALL ON TABLE public.statusi_vozila TO authenticated;
GRANT ALL ON TABLE public.statusi_vozila TO service_role;


--
-- TOC entry 4063 (class 0 OID 0)
-- Dependencies: 367
-- Name: SEQUENCE statusi_vozila_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.statusi_vozila_id_seq TO anon;
GRANT ALL ON SEQUENCE public.statusi_vozila_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.statusi_vozila_id_seq TO service_role;


--
-- TOC entry 4064 (class 0 OID 0)
-- Dependencies: 366
-- Name: TABLE tipovi_goriva; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tipovi_goriva TO anon;
GRANT ALL ON TABLE public.tipovi_goriva TO authenticated;
GRANT ALL ON TABLE public.tipovi_goriva TO service_role;


--
-- TOC entry 4065 (class 0 OID 0)
-- Dependencies: 365
-- Name: SEQUENCE tipovi_goriva_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tipovi_goriva_id_seq TO anon;
GRANT ALL ON SEQUENCE public.tipovi_goriva_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.tipovi_goriva_id_seq TO service_role;


--
-- TOC entry 4066 (class 0 OID 0)
-- Dependencies: 360
-- Name: TABLE uloge; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.uloge TO anon;
GRANT ALL ON TABLE public.uloge TO authenticated;
GRANT ALL ON TABLE public.uloge TO service_role;


--
-- TOC entry 4067 (class 0 OID 0)
-- Dependencies: 359
-- Name: SEQUENCE uloge_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.uloge_id_seq TO anon;
GRANT ALL ON SEQUENCE public.uloge_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.uloge_id_seq TO service_role;


--
-- TOC entry 4068 (class 0 OID 0)
-- Dependencies: 374
-- Name: TABLE vozila; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vozila TO anon;
GRANT ALL ON TABLE public.vozila TO authenticated;
GRANT ALL ON TABLE public.vozila TO service_role;


--
-- TOC entry 4069 (class 0 OID 0)
-- Dependencies: 373
-- Name: SEQUENCE vozila_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.vozila_id_seq TO anon;
GRANT ALL ON SEQUENCE public.vozila_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.vozila_id_seq TO service_role;


--
-- TOC entry 4070 (class 0 OID 0)
-- Dependencies: 378
-- Name: TABLE zaduzenja; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.zaduzenja TO anon;
GRANT ALL ON TABLE public.zaduzenja TO authenticated;
GRANT ALL ON TABLE public.zaduzenja TO service_role;


--
-- TOC entry 4071 (class 0 OID 0)
-- Dependencies: 377
-- Name: SEQUENCE zaduzenja_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.zaduzenja_id_seq TO anon;
GRANT ALL ON SEQUENCE public.zaduzenja_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.zaduzenja_id_seq TO service_role;


--
-- TOC entry 4072 (class 0 OID 0)
-- Dependencies: 376
-- Name: TABLE zaposlenici; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.zaposlenici TO anon;
GRANT ALL ON TABLE public.zaposlenici TO authenticated;
GRANT ALL ON TABLE public.zaposlenici TO service_role;


--
-- TOC entry 4073 (class 0 OID 0)
-- Dependencies: 375
-- Name: SEQUENCE zaposlenici_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.zaposlenici_id_seq TO anon;
GRANT ALL ON SEQUENCE public.zaposlenici_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.zaposlenici_id_seq TO service_role;


--
-- TOC entry 4074 (class 0 OID 0)
-- Dependencies: 356
-- Name: TABLE zupanije; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.zupanije TO anon;
GRANT ALL ON TABLE public.zupanije TO authenticated;
GRANT ALL ON TABLE public.zupanije TO service_role;


--
-- TOC entry 4075 (class 0 OID 0)
-- Dependencies: 355
-- Name: SEQUENCE zupanije_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.zupanije_id_seq TO anon;
GRANT ALL ON SEQUENCE public.zupanije_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.zupanije_id_seq TO service_role;


--
-- TOC entry 2495 (class 826 OID 16494)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2496 (class 826 OID 16495)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2494 (class 826 OID 16493)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2498 (class 826 OID 16497)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2493 (class 826 OID 16492)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- TOC entry 2497 (class 826 OID 16496)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Completed on 2026-05-05 15:46:56

--
-- PostgreSQL database dump complete
--
