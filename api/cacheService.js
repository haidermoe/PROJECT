/**
 * ============================================================================
 * Odoo 19 Style High-Performance ORM Cache Service (Smart In-Memory Caching)
 * ============================================================================
 * 
 * مستوحى مباشرة من محرك @tools.ormcache في Odoo 19
 * يوفر تخزيناً مؤقتاً فائق السرعة في الذاكرة (In-Memory) للاستعلامات المالية والمؤشرات
 * مع تفريغ ذكي لحظي (Smart Invalidation) بمجرد حدوث أي قيد أو حركة بيع جديدة.
 */

class OdooCacheService {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0
    };
  }

  /**
   * جلب قيمة من الكاش أو احتسابها وتخزينها تلقائياً
   * @param {string} key مفتاح الكاش الفريد
   * @param {number} ttlSeconds مدة البقاء بالثواني (افتراضي: 45 ثانية)
   * @param {Array<string>} tags وسوم التصنيف (مثل 'accounting', 'branches')
   * @param {Function} fetchFn دالة جلب البيانات من قاعدة البيانات عند عدم توفر الكاش
   */
  async wrap(key, ttlSeconds = 45, tags = [], fetchFn) {
    const cached = this.get(key);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;
    const data = await fetchFn();
    this.set(key, data, ttlSeconds, tags);
    return data;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data, ttlSeconds = 45, tags = []) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      tags: Array.isArray(tags) ? tags : [tags]
    });
  }

  /**
   * إبطال الكاش الذكي بحسب الوسم (مثل invalidate(['accounting']))
   * مطابق لنظام odoo: env.registry.clear_cache()
   */
  invalidate(tags = []) {
    const targetTags = Array.isArray(tags) ? tags : [tags];
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      const match = targetTags.some(t => entry.tags.includes(t));
      if (match) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.invalidations += count;
  }

  /**
   * مسح كامل الكاش
   */
  clear() {
    this.cache.clear();
  }

  /**
   * إحصائيات الكاش للأداء
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRatio = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%';
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio,
      invalidations: this.stats.invalidations
    };
  }
}

const cacheService = new OdooCacheService();

module.exports = cacheService;
