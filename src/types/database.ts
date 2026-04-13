export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_events: {
        Row: {
          id: number
          id_zapisa: number | null
          izvorna_tablica: string
          kreirano_u: string
          operacija: string
          tip_dogadjaja: string
        }
        Insert: {
          id?: number
          id_zapisa?: number | null
          izvorna_tablica: string
          kreirano_u?: string
          operacija: string
          tip_dogadjaja: string
        }
        Update: {
          id?: number
          id_zapisa?: number | null
          izvorna_tablica?: string
          kreirano_u?: string
          operacija?: string
          tip_dogadjaja?: string
        }
        Relationships: []
      }
      drzave: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      evidencija_goriva: {
        Row: {
          cijena_po_litri: number
          datum: string
          id: number
          km_tocenja: number
          litraza: number
          ukupni_iznos: number | null
          zaduzenje_id: number | null
        }
        Insert: {
          cijena_po_litri: number
          datum?: string
          id?: never
          km_tocenja: number
          litraza: number
          ukupni_iznos?: number | null
          zaduzenje_id?: number | null
        }
        Update: {
          cijena_po_litri?: number
          datum?: string
          id?: never
          km_tocenja?: number
          litraza?: number
          ukupni_iznos?: number | null
          zaduzenje_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidencija_goriva_zaduzenje_id_fkey"
            columns: ["zaduzenje_id"]
            isOneToOne: false
            referencedRelation: "zaduzenja"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencija_guma: {
        Row: {
          cijena: number | null
          datum_kupovine: string | null
          id: number
          proizvodjac: string | null
          sezona: string | null
          vozilo_id: number | null
        }
        Insert: {
          cijena?: number | null
          datum_kupovine?: string | null
          id?: never
          proizvodjac?: string | null
          sezona?: string | null
          vozilo_id?: number | null
        }
        Update: {
          cijena?: number | null
          datum_kupovine?: string | null
          id?: never
          proizvodjac?: string | null
          sezona?: string | null
          vozilo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidencija_guma_vozilo_id_fkey"
            columns: ["vozilo_id"]
            isOneToOne: false
            referencedRelation: "vozila"
            referencedColumns: ["id"]
          },
        ]
      }
      kategorije_kvarova: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      kategorije_vozila: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      mjesta: {
        Row: {
          id: number
          naziv: string
          zupanija_id: number | null
        }
        Insert: {
          id?: never
          naziv: string
          zupanija_id?: number | null
        }
        Update: {
          id?: never
          naziv?: string
          zupanija_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mjesta_zupanija_id_fkey"
            columns: ["zupanija_id"]
            isOneToOne: false
            referencedRelation: "zupanije"
            referencedColumns: ["id"]
          },
        ]
      }
      modeli: {
        Row: {
          id: number
          kapacitet_rezervoara: number | null
          kategorija_id: number | null
          mali_servis_interval_km: number | null
          naziv: string
          proizvodjac_id: number | null
          tip_goriva_id: number | null
          veliki_servis_interval_km: number | null
        }
        Insert: {
          id?: never
          kapacitet_rezervoara?: number | null
          kategorija_id?: number | null
          mali_servis_interval_km?: number | null
          naziv: string
          proizvodjac_id?: number | null
          tip_goriva_id?: number | null
          veliki_servis_interval_km?: number | null
        }
        Update: {
          id?: never
          kapacitet_rezervoara?: number | null
          kategorija_id?: number | null
          mali_servis_interval_km?: number | null
          naziv?: string
          proizvodjac_id?: number | null
          tip_goriva_id?: number | null
          veliki_servis_interval_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modeli_kategorija_id_fkey"
            columns: ["kategorija_id"]
            isOneToOne: false
            referencedRelation: "kategorije_vozila"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modeli_proizvodjac_id_fkey"
            columns: ["proizvodjac_id"]
            isOneToOne: false
            referencedRelation: "proizvodjaci"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modeli_tip_goriva_id_fkey"
            columns: ["tip_goriva_id"]
            isOneToOne: false
            referencedRelation: "tipovi_goriva"
            referencedColumns: ["id"]
          },
        ]
      }
      proizvodjaci: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      registracije: {
        Row: {
          cijena: number | null
          datum_isteka: string
          datum_registracije: string
          id: number
          registracijska_oznaka: string
          vozilo_id: number | null
        }
        Insert: {
          cijena?: number | null
          datum_isteka: string
          datum_registracije: string
          id?: never
          registracijska_oznaka: string
          vozilo_id?: number | null
        }
        Update: {
          cijena?: number | null
          datum_isteka?: string
          datum_registracije?: string
          id?: never
          registracijska_oznaka?: string
          vozilo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registracije_vozilo_id_fkey"
            columns: ["vozilo_id"]
            isOneToOne: false
            referencedRelation: "vozila"
            referencedColumns: ["id"]
          },
        ]
      }
      servisne_intervencije: {
        Row: {
          attachment_url: string | null
          cijena: number | null
          datum_pocetka: string
          datum_zavrsetka: string | null
          hitnost: string | null
          id: number
          kategorija_id: number | null
          km_u_tom_trenutku: number
          opis: string | null
          status_prijave: string | null
          vozilo_id: number | null
          zaposlenik_id: number | null
        }
        Insert: {
          attachment_url?: string | null
          cijena?: number | null
          datum_pocetka?: string
          datum_zavrsetka?: string | null
          hitnost?: string | null
          id?: never
          kategorija_id?: number | null
          km_u_tom_trenutku: number
          opis?: string | null
          status_prijave?: string | null
          vozilo_id?: number | null
          zaposlenik_id?: number | null
        }
        Update: {
          attachment_url?: string | null
          cijena?: number | null
          datum_pocetka?: string
          datum_zavrsetka?: string | null
          hitnost?: string | null
          id?: never
          kategorija_id?: number | null
          km_u_tom_trenutku?: number
          opis?: string | null
          status_prijave?: string | null
          vozilo_id?: number | null
          zaposlenik_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servisne_intervencije_kategorija_id_fkey"
            columns: ["kategorija_id"]
            isOneToOne: false
            referencedRelation: "kategorije_kvarova"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servisne_intervencije_vozilo_id_fkey"
            columns: ["vozilo_id"]
            isOneToOne: false
            referencedRelation: "vozila"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servisne_intervencije_zaposlenik_id_fkey"
            columns: ["zaposlenik_id"]
            isOneToOne: false
            referencedRelation: "zaposlenici"
            referencedColumns: ["id"]
          },
        ]
      }
      statusi_vozila: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      tipovi_goriva: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      uloge: {
        Row: {
          id: number
          naziv: string
        }
        Insert: {
          id?: never
          naziv: string
        }
        Update: {
          id?: never
          naziv?: string
        }
        Relationships: []
      }
      vozila: {
        Row: {
          broj_sasije: string
          datum_kupovine: string | null
          godina_proizvodnje: number | null
          id: number
          is_aktivan: boolean | null
          mjesto_id: number | null
          model_id: number | null
          nabavna_vrijednost: number | null
          razlog_deaktivacije: string | null
          status_id: number | null
          trenutna_km: number | null
          zadnji_mali_servis_datum: string | null
          zadnji_mali_servis_km: number | null
          zadnji_veliki_servis_datum: string | null
          zadnji_veliki_servis_km: number | null
        }
        Insert: {
          broj_sasije: string
          datum_kupovine?: string | null
          godina_proizvodnje?: number | null
          id?: never
          is_aktivan?: boolean | null
          mjesto_id?: number | null
          model_id?: number | null
          nabavna_vrijednost?: number | null
          razlog_deaktivacije?: string | null
          status_id?: number | null
          trenutna_km?: number | null
          zadnji_mali_servis_datum?: string | null
          zadnji_mali_servis_km?: number | null
          zadnji_veliki_servis_datum?: string | null
          zadnji_veliki_servis_km?: number | null
        }
        Update: {
          broj_sasije?: string
          datum_kupovine?: string | null
          godina_proizvodnje?: number | null
          id?: never
          is_aktivan?: boolean | null
          mjesto_id?: number | null
          model_id?: number | null
          nabavna_vrijednost?: number | null
          razlog_deaktivacije?: string | null
          status_id?: number | null
          trenutna_km?: number | null
          zadnji_mali_servis_datum?: string | null
          zadnji_mali_servis_km?: number | null
          zadnji_veliki_servis_datum?: string | null
          zadnji_veliki_servis_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vozila_mjesto_id_fkey"
            columns: ["mjesto_id"]
            isOneToOne: false
            referencedRelation: "mjesta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vozila_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "modeli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vozila_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statusi_vozila"
            referencedColumns: ["id"]
          },
        ]
      }
      zaduzenja: {
        Row: {
          datum_do: string | null
          datum_od: string
          id: number
          is_aktivno: boolean | null
          km_pocetna: number
          km_zavrsna: number | null
          vozilo_id: number | null
          zaposlenik_id: number | null
        }
        Insert: {
          datum_do?: string | null
          datum_od?: string
          id?: never
          is_aktivno?: boolean | null
          km_pocetna: number
          km_zavrsna?: number | null
          vozilo_id?: number | null
          zaposlenik_id?: number | null
        }
        Update: {
          datum_do?: string | null
          datum_od?: string
          id?: never
          is_aktivno?: boolean | null
          km_pocetna?: number
          km_zavrsna?: number | null
          vozilo_id?: number | null
          zaposlenik_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "zaduzenja_vozilo_id_fkey"
            columns: ["vozilo_id"]
            isOneToOne: false
            referencedRelation: "vozila"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaduzenja_zaposlenik_id_fkey"
            columns: ["zaposlenik_id"]
            isOneToOne: false
            referencedRelation: "zaposlenici"
            referencedColumns: ["id"]
          },
        ]
      }
      zaposlenici: {
        Row: {
          email: string | null
          id: number
          ime: string
          is_aktivan: boolean | null
          korisnicko_ime: string
          lozinka: string
          mjesto_id: number | null
          pozivnica_token: string | null
          pozivnica_vrijedi_do: string | null
          prezime: string
          razlog_deaktivacije: string | null
          uloga_id: number | null
        }
        Insert: {
          email?: string | null
          id?: never
          ime: string
          is_aktivan?: boolean | null
          korisnicko_ime: string
          lozinka: string
          mjesto_id?: number | null
          pozivnica_token?: string | null
          pozivnica_vrijedi_do?: string | null
          prezime: string
          razlog_deaktivacije?: string | null
          uloga_id?: number | null
        }
        Update: {
          email?: string | null
          id?: never
          ime?: string
          is_aktivan?: boolean | null
          korisnicko_ime?: string
          lozinka?: string
          mjesto_id?: number | null
          pozivnica_token?: string | null
          pozivnica_vrijedi_do?: string | null
          prezime?: string
          razlog_deaktivacije?: string | null
          uloga_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "zaposlenici_mjesto_id_fkey"
            columns: ["mjesto_id"]
            isOneToOne: false
            referencedRelation: "mjesta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaposlenici_uloga_id_fkey"
            columns: ["uloga_id"]
            isOneToOne: false
            referencedRelation: "uloge"
            referencedColumns: ["id"]
          },
        ]
      }
      zupanije: {
        Row: {
          drzava_id: number | null
          id: number
          naziv: string
        }
        Insert: {
          drzava_id?: number | null
          id?: never
          naziv: string
        }
        Update: {
          drzava_id?: number | null
          id?: never
          naziv?: string
        }
        Relationships: [
          {
            foreignKeyName: "zupanije_drzava_id_fkey"
            columns: ["drzava_id"]
            isOneToOne: false
            referencedRelation: "drzave"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
