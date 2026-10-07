/**
 * RETHA Admin Panel — Supabase API Client Service
 * Fully isolated from public frontend
 */
import { supabase } from '../src/utils/supabase.js';

export const adminApi = {
  // Client instance
  supabase,

  // --- AUTHENTICATION ---
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  // --- PROPERTIES CRUD ---
  async getProperties({ search = '', status = 'all', propertyType = 'all' } = {}) {
    let query = supabase
      .from('properties')
      .select('*, property_images(id, image_url, image_type, display_order)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      if (status === 'reserved') {
        query = query.in('status', ['reserved', 'pending']);
      } else {
        query = query.eq('status', status);
      }
    }

    if (propertyType && propertyType !== 'all') {
      query = query.eq('property_type', propertyType);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];

    // Ensure property_images are deterministically sorted by display_order
    if (results.length > 0) {
      results.forEach((p) => {
        if (Array.isArray(p.property_images)) {
          p.property_images.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));
        }
      });
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter((p) => {
        return (
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.title_ar && p.title_ar.includes(q)) ||
          (p.reference_code && p.reference_code.toLowerCase().includes(q)) ||
          (p.city && p.city.toLowerCase().includes(q)) ||
          (p.neighborhood && p.neighborhood.toLowerCase().includes(q))
        );
      });
    }

    return results;
  },

  async getPropertyById(id) {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_images(*), property_status_history(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (data && Array.isArray(data.property_images)) {
      data.property_images.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));
    }
    return data;
  },

  async createProperty(propertyData) {
    // Generate unique slug if not provided
    if (!propertyData.slug && propertyData.title) {
      propertyData.slug = propertyData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 7);
    }

    const { data, error } = await supabase
      .from('properties')
      .insert([propertyData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProperty(id, propertyData) {
    const { data, error } = await supabase
      .from('properties')
      .update(propertyData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProperty(id) {
    // Foreign key constraint cascade deletes property_images in database
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async getPropertyStatusHistory(propertyId) {
    const { data, error } = await supabase
      .from('property_status_history')
      .select('*')
      .eq('property_id', propertyId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // --- IMAGES & STORAGE ---
  async getPropertyImages(propertyId) {
    const { data, error } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', propertyId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async uploadPropertyImage(propertyId, file, imageType = 'exterior', displayOrder = 0, title = '') {
    // Sanitize file name
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `${propertyId}/${imageType}/${Date.now()}_${cleanBase}.${ext}`;

    // 1. Upload to Supabase Storage bucket 'property-images'
    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || `image/${ext}`
      });

    if (uploadError) throw uploadError;

    // 2. Get Public URL
    const { data: urlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 3. Insert record into property_images table
    const { data: imgRecord, error: dbError } = await supabase
      .from('property_images')
      .insert([
        {
          property_id: propertyId,
          image_url: publicUrl,
          image_type: imageType,
          display_order: Number(displayOrder) || 0,
          title: title || file.name
        }
      ])
      .select()
      .single();

    if (dbError) throw dbError;
    return imgRecord;
  },

  async updateImageOrder(imageId, newOrder) {
    const { data, error } = await supabase
      .from('property_images')
      .update({ display_order: Number(newOrder) })
      .eq('id', imageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletePropertyImage(imageId, imageUrl) {
    // 1. Try deleting from storage bucket if it belongs to property-images
    try {
      if (imageUrl && imageUrl.includes('property-images/')) {
        const parts = imageUrl.split('property-images/');
        if (parts.length > 1) {
          const filePath = decodeURIComponent(parts[1].split('?')[0]);
          await supabase.storage.from('property-images').remove([filePath]);
        }
      }
    } catch (e) {
      console.warn('Storage file cleanup warning:', e);
    }

    // 2. Delete record from database
    const { error } = await supabase
      .from('property_images')
      .delete()
      .eq('id', imageId);

    if (error) throw error;
    return true;
  },

  // --- LEADS MANAGEMENT ---
  async getLeads({ status = 'all', propertyId = 'all', search = '' } = {}) {
    let query = supabase
      .from('leads')
      .select('*, properties(id, title, reference_code)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      if (status === 'reserved') {
        query = query.in('status', ['reserved', 'pending']);
      } else if (status === 'sold') {
        query = query.in('status', ['sold', 'notified_sold']);
      } else {
        query = query.eq('status', status);
      }
    }

    if (propertyId && propertyId !== 'all') {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter((lead) => {
        return (
          (lead.full_name && lead.full_name.toLowerCase().includes(q)) ||
          (lead.phone && lead.phone.toLowerCase().includes(q)) ||
          (lead.email && lead.email.toLowerCase().includes(q))
        );
      });
    }

    return results;
  },

  async updateLeadStatus(leadId, newStatus) {
    if (!['new', 'contacted', 'reserved', 'sold', 'closed', 'pending', 'notified_sold'].includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    let { data, error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)
      .select()
      .single();

    // If 'sold' failed because check constraint only allows 'notified_sold', fall back gracefully
    if (error && newStatus === 'sold') {
      const fallback = await supabase
        .from('leads')
        .update({ status: 'notified_sold' })
        .eq('id', leadId)
        .select()
        .single();
      if (!fallback.error) return fallback.data;
    }

    // If 'reserved' failed because check constraint doesn't allow it on leads table directly
    if (error && newStatus === 'reserved') {
      const fallback = await supabase
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', leadId)
        .select()
        .single();
      if (!fallback.error) return fallback.data;
    }

    if (error) throw error;
    return data;
  },

  async deleteLead(leadId) {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId);

    if (error) throw error;
    return true;
  },

  // --- TELEGRAM RECIPIENTS MANAGEMENT ---
  async getTelegramRecipients({ search = '', active = 'all' } = {}) {
    let query = supabase
      .from('telegram_recipients')
      .select('*')
      .order('created_at', { ascending: false });

    if (active !== 'all') {
      const isActive = active === 'true' || active === true;
      query = query.eq('active', isActive);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter((r) => {
        return (
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.chat_id && r.chat_id.toLowerCase().includes(q))
        );
      });
    }

    return results;
  },

  async getTelegramRecipientById(id) {
    const { data, error } = await supabase
      .from('telegram_recipients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createTelegramRecipient({ name, chat_id, active = true }) {
    if (!chat_id || !chat_id.trim()) {
      throw new Error('Telegram Chat ID is required');
    }

    const { data, error } = await supabase
      .from('telegram_recipients')
      .insert([
        {
          name: name ? name.trim() : null,
          chat_id: chat_id.trim(),
          active: Boolean(active)
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTelegramRecipient(id, { name, chat_id, active }) {
    const updates = {};
    if (name !== undefined) updates.name = name ? name.trim() : null;
    if (chat_id !== undefined) updates.chat_id = chat_id.trim();
    if (active !== undefined) updates.active = Boolean(active);

    const { data, error } = await supabase
      .from('telegram_recipients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTelegramRecipient(id) {
    const { error } = await supabase
      .from('telegram_recipients')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
