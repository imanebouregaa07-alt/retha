export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          budget_range: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          message: string | null
          phone: string
          preferred_contact_method: string | null
          property_id: string | null
          status: string
        }
        Insert: {
          budget_range?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          message?: string | null
          phone: string
          preferred_contact_method?: string | null
          property_id?: string | null
          status?: string
        }
        Update: {
          budget_range?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          message?: string | null
          phone?: string
          preferred_contact_method?: string | null
          property_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          }
        ]
      }
      properties: {
        Row: {
          amenities: string[] | null
          area_sqm: number | null
          badge: string | null
          badge_color: string | null
          bathrooms: number | null
          bedrooms: number | null
          built_up_area: string | null
          city: string | null
          created_at: string
          deed_number: string | null
          description: string | null
          features_summary: string | null
          garage_capacity: string | null
          id: string
          latitude: number | null
          longitude: number | null
          main_image: string | null
          metadata: Json | null
          neighborhood: string | null
          orientation: string | null
          price: number | null
          property_type: 'villa' | 'apartment' | 'office' | 'land' | null
          reference_code: string | null
          slug: string | null
          status: 'available' | 'reserved' | 'sold'
          street_width: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          area_sqm?: number | null
          badge?: string | null
          badge_color?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_up_area?: string | null
          city?: string | null
          created_at?: string
          deed_number?: string | null
          description?: string | null
          features_summary?: string | null
          garage_capacity?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          main_image?: string | null
          metadata?: Json | null
          neighborhood?: string | null
          orientation?: string | null
          price?: number | null
          property_type?: 'villa' | 'apartment' | 'office' | 'land' | null
          reference_code?: string | null
          slug?: string | null
          status?: 'available' | 'reserved' | 'sold'
          street_width?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          area_sqm?: number | null
          badge?: string | null
          badge_color?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          built_up_area?: string | null
          city?: string | null
          created_at?: string
          deed_number?: string | null
          description?: string | null
          features_summary?: string | null
          garage_capacity?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          main_image?: string | null
          metadata?: Json | null
          neighborhood?: string | null
          orientation?: string | null
          price?: number | null
          property_type?: 'villa' | 'apartment' | 'office' | 'land' | null
          reference_code?: string | null
          slug?: string | null
          status?: 'available' | 'reserved' | 'sold'
          street_width?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_images: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_type: string | null
          image_url: string
          property_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_type?: string | null
          image_url: string
          property_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_type?: string | null
          image_url?: string
          property_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          }
        ]
      }
      property_status_history: {
        Row: {
          changed_at: string
          changed_via: string | null
          id: string
          new_status: string | null
          old_status: string | null
          property_id: string
        }
        Insert: {
          changed_at?: string
          changed_via?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          property_id: string
        }
        Update: {
          changed_at?: string
          changed_via?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_status_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          }
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
