import { PRODUCT_NAME } from './brand'
import type { Lang } from './copy'

export type LegalDocKind = 'privacy' | 'terms' | 'kvkk'

export type LegalSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: { label?: string; text: string }[]
  table?: {
    headers: string[]
    rows: string[][]
  }
  note?: string
}

export type LegalDocument = {
  metaTitle: string
  metaDescription: string
  eyebrow: string
  title: string
  subtitle: string
  versionBadge: string
  statusBadge: string
  effectiveDate: string
  tocTitle: string
  sections: LegalSection[]
  siblingLabel: string
  siblingCta: string
}

export type LegalUiCopy = {
  backHome: string
  applyPilot: string
  contactEmail: string
  dpoEmail: string
  kvkkLinkLabel?: string
  privacy: LegalDocument
  terms: LegalDocument
}

const VERSION = '2026-11-16'

export const kvkkEnNotice = {
  body: 'This KVKK Information Notice (Aydınlatma Metni) is published in Turkish only in accordance with Turkish Personal Data Protection Law No. 6698.',
  privacyLink: 'Read the English Privacy Policy',
}

export const kvkkDocument: LegalDocument = {
  metaTitle: `KVKK Aydınlatma Metni · ${PRODUCT_NAME}`,
  metaDescription:
    '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında Pivoris web sitesi, pilot başvurusu ve platform kullanıcı verilerine ilişkin aydınlatma metni.',
  eyebrow: '6698 sayılı KVKK · Aydınlatma Metni',
  title: 'Kişisel Verilerin Korunması Aydınlatma Metni',
  subtitle:
    '6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, Pivoris web sitesini ziyaret etmeniz, pilot programına başvurmanız veya platform hesaplarını kullanmanız kapsamında işlenen kişisel verilerinize ilişkin aydınlatma metnidir.',
  versionBadge: `Sürüm ${VERSION}`,
  statusBadge: 'Taslak · hukuki inceleme bekliyor',
  effectiveDate: 'Son güncelleme: 16 Kasım 2026',
  tocTitle: 'İçindekiler',
  siblingLabel: 'İlgili belge',
  siblingCta: 'Gizlilik Politikasını oku',
  sections: [
    {
      id: 'veri-sorumlusu',
      title: '1. Veri Sorumlusunun Kimliği ve Rol Ayrımı',
      paragraphs: [
        '6698 sayılı KVKK uyarınca, bu internet sitesi, pilot bekleme listesi başvuruları ve Pivoris platformu kullanıcı hesaplarına ilişkin kişisel veriler bakımından Veri Sorumlusu Pivoris operasyon ekibidir.',
      ],
      bullets: [
        { label: 'İletişim E-postası', text: 'privacy@pivoris.com' },
        { label: 'Veri Koruma İrtibatı', text: 'dpo@pivoris.com' },
        { label: 'Konum', text: 'İstanbul, Türkiye (resmî şirket unvanı ve adres bilgileri hukuki inceleme tamamlandığında eklenecektir)' },
        {
          label: 'İşletme müşterilerinin Instagram verileri hakkında',
          text: 'Pivoris kullanan işletmelerin kendi Instagram hesapları üzerinden müşterilerinden aldığı DM ve yorum içeriklerinde Veri Sorumlusu ilgili abone işletmedir; Pivoris yalnızca Veri İşleyen sıfatıyla hareket eder ve işletmelere kendi müşterilerine sunabilecekleri KVKK Aydınlatma Metni şablonunu sağlar.',
        },
      ],
    },
    {
      id: 'islenen-veriler-amaclar',
      title: '2. İşlenen Kişisel Veriler ve İşleme Amaçları',
      paragraphs: [
        'Pivoris tarafından yalnızca aşağıda belirtilen amaçlarla sınırlı ve ölçülü olarak kişisel veriler işlenmektedir:',
      ],
      table: {
        headers: ['Veri Kategorisi', 'İşlenen Veri Unsurları', 'İşleme Amacı'],
        rows: [
          [
            'Pilot başvuru / iletişim bilgileri',
            'İşletme adı, işletme türü, Instagram kullanıcı adı, e-posta adresi, şehir, dil tercihi.',
            'Pilot başvurularının değerlendirilmesi, sizinle 24 saat içinde iletişime geçilmesi ve kurulum randevusu planlanması.',
          ],
          [
            'Kullanıcı hesap ve kimlik bilgileri',
            'Ad / görünen ad, e-posta adresi, çalışma alanı rolü (sahip, yönetici, personel), parola özeti (argon2id).',
            'Üyelik ve çalışma alanı oluşturma, yetkilendirme, parola sıfırlama ve hesap yönetimi süreçlerinin yürütülmesi.',
          ],
          [
            'İşlem güvenliği ve denetim kayıtları',
            'Şifreli oturum tanımlayıcıları, giriş/çıkış zaman damgaları, yönetimsel işlem kayıtları, IP adresi.',
            'Bilgi güvenliğinin sağlanması, yetkisiz erişimin önlenmesi ve mevzuattan kaynaklanan yükümlülüklerin yerine getirilmesi.',
          ],
          [
            'Entegrasyon ve doğrulanan işletme bilgileri',
            'Instagram işletme hesabı kimliği/kullanıcı adı, AES-256-GCM ile şifrelenmiş OAuth erişim jetonları, doğrulanan fiyat/saat/adres kartları.',
            'İşletme adına Instagram mesaj/yorum ve içerik planlama entegrasyonlarının güvenli biçimde çalıştırılması.',
          ],
        ],
      },
      note: 'Tanıtım sitemizde üçüncü taraf reklam veya takip çerezleri kullanılmaz; yalnızca seçtiğiniz dil ve tema tercihi tarayıcınızın yerel depolama alanında (localStorage) tutulur.',
    },
    {
      id: 'toplama-yontemi-hukuki-sebep',
      title: '3. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebepleri',
      paragraphs: [
        'Kişisel verileriniz; internet sitemizdeki pilot başvuru formu, platform kayıt/giriş ve ayar ekranları, e-posta veya WhatsApp/Telegram iletişim kanalları üzerinden elektronik ortamda, tamamen veya kısmen otomatik yöntemlerle toplanmaktadır.',
        'Toplanan veriler KVKK’nın 5. maddesi uyarınca aşağıdaki hukuki sebeplere dayanılarak işlenir:',
      ],
      bullets: [
        {
          label: 'KVKK m. 5/1 (Açık Rıza)',
          text: 'Pilot programı hakkında sizinle iletişime geçilmesi için başvuru formunda onay kutusunu işaretleyerek verdiğiniz açık rıza.',
        },
        {
          label: 'KVKK m. 5/2(c) (Sözleşmenin Kurulması veya İfası)',
          text: 'Pilot veya platform kullanımına ilişkin hesap oluşturulması, entegrasyonların kurulması ve hizmetin sunulması.',
        },
        {
          label: 'KVKK m. 5/2(ç) (Hukuki Yükümlülük)',
          text: 'Yetkili kurum taleplerinin karşılanması, bilgi güvenliği ve mevzuat yükümlülüklerinin yerine getirilmesi.',
        },
        {
          label: 'KVKK m. 5/2(f) (Meşru Menfaat)',
          text: 'Temel hak ve özgürlüklerinize zarar vermemek kaydıyla sistem güvenliği, hata giderme ve hizmet kalitesinin korunması.',
        },
      ],
    },
    {
      id: 'aktarim',
      title: '4. Kişisel Verilerin Aktarılması ve Yurt Dışı Aktarım',
      paragraphs: [
        'Kişisel verileriniz; yukarıdaki amaçların gerçekleştirilmesi için gerekli olduğu ölçüde altyapı ve bulut barındırma sağlayıcılarına, şifreli yedekleme ve nesne depolama hizmetlerine, işlem e-postası gönderim sağlayıcılarına ve yasal bir zorunluluk bulunması halinde yetkili kamu kurum ve kuruluşlarına aktarılabilir.',
        'Platform içindeki yapay zekâ destekli taslak hazırlama süreçlerinde yalnızca kurumsal API uç noktaları (Sıfır Veri Saklama / model eğitiminde kullanılmama güvencesiyle) kullanılır; pilot başvuru verileriniz hiçbir şekilde üçüncü taraflara pazarlama amacıyla satılmaz veya devredilmez.',
        'Yurt dışındaki hizmet sağlayıcılarla gerçekleştirilen teknik aktarımlar, KVKK’nın 9. maddesinde öngörülen standart sözleşme / taahhütname ve uygun güvenlik güvenceleri çerçevesinde yürütülür.',
      ],
    },
    {
      id: 'saklama-imha',
      title: '5. Kişisel Verilerin Saklanması ve İmhası',
      paragraphs: [
        'Kişisel verileriniz işleme amacının gerektirdiği süre boyunca saklanır ve sürenin dolması veya talebiniz üzerine silinir, yok edilir veya anonim hale getirilir:',
      ],
      bullets: [
        {
          label: 'Pilot bekleme listesi başvuruları',
          text: 'Pilot süreci boyunca veya silme talebinize kadar saklanır; talebiniz üzerine derhal sistemden silinir.',
        },
        {
          label: 'Platform kayıtları ve yedekler',
          text: 'Ham webhook yükleri 30 günde içeriksizleştirilip 90 günde silinir; müşteri mesaj metinleri 365 gün sonunda temizlenir; şifreli veritabanı yedekleri 35 gün sonunda otomatik silinir. Çalışma alanı silme talebi 7 günlük bekleme süresinin ardından kalıcı imhayla sonuçlanır.',
        },
      ],
    },
    {
      id: 'kvkk-madde-11',
      title: '6. KVKK’nın 11. Maddesi Kapsamındaki Haklarınız',
      paragraphs: [
        '6698 sayılı Kanun’un 11. maddesi uyarınca veri sahibi olarak Pivoris’e başvurarak aşağıdaki haklara sahipsiniz:',
      ],
      bullets: [
        { text: 'Kişisel verilerinizin işlenip işlenmediğini öğrenme,' },
        { text: 'Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,' },
        { text: 'Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,' },
        { text: 'Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,' },
        { text: 'Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,' },
        { text: 'KVKK’nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,' },
        { text: 'Düzeltme, silme ve yok edilme işlemlerinin kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme,' },
        { text: 'İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,' },
        { text: 'Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.' },
      ],
    },
    {
      id: 'basvuru-yontemi',
      title: '7. Veri Sorumlusuna Başvuru Yöntemi',
      paragraphs: [
        'KVKK’nın 11. maddesi kapsamındaki taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca kimliğinizi doğrulayıcı bilgilerle birlikte privacy@pivoris.com veya dpo@pivoris.com adresine iletebilirsiniz.',
        'Başvurularınız talebin niteliğine göre en kısa sürede ve en geç otuz (30) gün içinde ücretsiz olarak sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulu tarafından belirlenen tarife esas alınabilir.',
      ],
    },
  ],
}

export const legalCopy: Record<Lang, LegalUiCopy> = {
  tr: {
    backHome: 'Ana sayfaya dön',
    applyPilot: 'Ücretsiz pilota başvurun',
    contactEmail: 'privacy@pivoris.com',
    dpoEmail: 'dpo@pivoris.com',
    kvkkLinkLabel: 'KVKK Aydınlatma Metni',
    privacy: {
      metaTitle: `Gizlilik Politikası · ${PRODUCT_NAME}`,
      metaDescription:
        'Pivoris’in pilot bekleme listesi, işletme hesapları ve Instagram müşteri iletişimleri kapsamında kişisel verileri nasıl işlediğini, koruduğunu ve sildiğini inceleyin.',
      eyebrow: 'Yasal belgeler',
      title: 'Gizlilik Politikası',
      subtitle:
        'Bu politika, Pivoris tanıtım sitesi (pilot başvurusu dahil) ve Pivoris platformu kapsamında kişisel verilerin nasıl toplandığını, işlendiğini, korunduğunu ve silindiğini açıklar.',
      versionBadge: `Sürüm ${VERSION}`,
      statusBadge: 'Taslak · hukuki inceleme bekliyor',
      effectiveDate: 'Son güncelleme: 16 Kasım 2026',
      tocTitle: 'İçindekiler',
      siblingLabel: 'İlgili belge',
      siblingCta: 'Kullanım Koşullarını oku',
      sections: [
        {
          id: 'kapsam-roller',
          title: '1. Kapsam ve Veri Koruma Rolleri',
          paragraphs: [
            `${PRODUCT_NAME}, küçük ve yerel işletmeler (pilates ve spor stüdyoları, klinikler, güzellik salonları, kafeler, butikler ve hizmet işletmeleri) için yapay zekâ destekli Instagram mesajlaşma, yorum yönetimi ve içerik planlama yazılımı sunar.`,
            '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve Avrupa Birliği Genel Veri Koruma Tüzüğü (GDPR) kapsamında veri koruma rolleri işlem türüne göre ayrılır:',
          ],
          bullets: [
            {
              label: 'Tanıtım sitesi, pilot başvuruları ve platform kullanıcı hesapları',
              text: `${PRODUCT_NAME}, web sitesindeki pilot başvuru formu, kayıtlı işletme kullanıcı hesapları, oturum güvenliği ve denetim kayıtları bakımından Veri Sorumlusu sıfatıyla hareket eder.`,
            },
            {
              label: 'Müşteri Instagram DM ve yorum iletişimleri',
              text: `Instagram hesabı üzerinden son müşterilerle yürütülen tüm mesajlaşma ve yorum içeriklerinde abone işletme (çalışma alanı sahibi) Veri Sorumlusudur. ${PRODUCT_NAME}, yalnızca işletmenin talimatları ve Veri İşleme Sözleşmesi (DPA) çerçevesinde Veri İşleyen olarak hizmet verir.`,
            },
            {
              label: 'Bağımsız platform sağlayıcıları',
              text: 'Meta Platforms Ireland Ltd. / Meta Platforms, Inc. (Instagram ve WhatsApp), Telegram ve Google (Takvim entegrasyonu seçildiğinde) kendi gizlilik politikaları ve kullanım şartları kapsamında bağımsız veri sorumluları olarak hareket eder.',
            },
          ],
        },
        {
          id: 'toplanan-veriler',
          title: '2. İşlenen Kişisel Veriler ve Çerez Tercihleri',
          paragraphs: [
            'Sunduğumuz hizmetin kapsamına göre yalnızca gerekli ve ölçülü düzeyde kişisel veri işlenir:',
          ],
          bullets: [
            {
              label: 'Tanıtım sitesi ve pilot başvuru formu',
              text: 'Pilot başvurusunda işletme adı, işletme türü, Instagram kullanıcı adı, e-posta adresi, şehir ve dil tercihi (tr/en) alınır. Bu sitede reklam amaçlı izleme çerezleri veya üçüncü taraf analitik takipçileri kullanılmaz; yalnızca tema ve dil tercihiniz tarayıcınızın yerel depolama alanında (localStorage) tutulur ve yazı tipleri kendi sunucumuzdan yüklenir.',
            },
            {
              label: 'Platform kullanıcı ve güvenlik verileri',
              text: 'Ad/görünen ad, e-posta adresi, çalışma alanı rolü (sahip, yönetici, personel), argon2id ile özetlenmiş parola kayıtları, şifrelenmiş HttpOnly oturum çerezleri ve yönetimsel işlemlerin değişmez denetim kayıtları (giriş zamanları, rol değişiklikleri, IP bilgisi).',
            },
            {
              label: 'İşletme entegrasyon ve bilgi verileri',
              text: 'Instagram işletme hesabı kimliği, kullanıcı adı ve AES-256-GCM ile şifrelenmiş OAuth erişim jetonları (Instagram şifreniz hiçbir zaman bize ulaşmaz ve saklanmaz) ile işletmenizin doğruladığı fiyat, çalışma saati, adres ve hizmet kartları.',
            },
            {
              label: 'Son müşteri iletişim verileri (Veri İşleyen kapsamında)',
              text: 'Instagram kapsamlı kullanıcı kimliği (IGSID), kullanıcı adı, gelen DM ve yorum metinleri, gönderilen yanıtlar, zaman damgaları ve sınıflandırma/taslak kayıtları. İşletme tarafından sesli mesaj yazıya dökme veya görsel tarifi etkinleştirilmişse, ses veya görsel dosyası yalnızca tek bir arka plan görevi süresince bellek üzerinden işlenir ve Pivoris tarafından kalıcı olarak saklanmaz.',
            },
          ],
        },
        {
          id: 'amaclar-hukuki-sebepler',
          title: '3. İşleme Amaçları ve Hukuki Sebepler',
          paragraphs: [
            'Kişisel veriler KVKK madde 5 ve GDPR madde 6 uyarınca aşağıdaki amaçlar ve hukuki sebeplerle sınırlı olarak işlenir:',
          ],
          table: {
            headers: ['Veri Kategorisi', 'İşleme Amacı', 'Hukuki Sebep (KVKK / GDPR)'],
            rows: [
              [
                'Pilot başvuru bilgileri',
                'Pilot başvurunuzu değerlendirmek, sizinle iletişime geçmek ve kurulum randevusu planlamak.',
                'Açık rızanız ve sözleşme öncesi görüşmeler (KVKK m. 5/1, 5/2(c); GDPR Art. 6(1)(a), 6(1)(b)).',
              ],
              [
                'Kullanıcı hesapları ve kimlik doğrulama',
                'Hesap oluşturma, oturum güvenliği sağlama, yetkilendirme ve parola sıfırlama.',
                'Sözleşmenin kurulması ve ifası, meşru menfaat (KVKK m. 5/2(c), 5/2(f); GDPR Art. 6(1)(b), 6(1)(f)).',
              ],
              [
                'Instagram ve kanal entegrasyonları',
                'İşletme adına Instagram DM/yorumlarını almak, yanıtları ve onaylı paylaşımları iletmek.',
                'Sözleşmenin ifası ve Veri İşleme Sözleşmesi kapsamındaki talimatlar (KVKK m. 5/2(c); GDPR Art. 6(1)(b)).',
              ],
              [
                'Güvenlik ve denetim kayıtları',
                'Yetkisiz erişimi önlemek, hata tespiti yapmak ve hukuki yükümlülükleri yerine getirmek.',
                'Hukuki yükümlülük ve veri güvenliği meşru menfaati (KVKK m. 5/2(ç), 5/2(f); GDPR Art. 6(1)(c), 6(1)(f)).',
              ],
            ],
          },
        },
        {
          id: 'yapay-zeka',
          title: '4. Yapay Zekâ Kullanımı ve Doğruluk Güvenceleri',
          bullets: [
            {
              label: 'Temel model eğitiminde kullanılmaz',
              text: 'Müşteri mesaj metinleri, müşteri kimlikleri ve işletmenize özel bilgiler genel yapay zekâ modellerini eğitmek için hiçbir şekilde kullanılmaz. Kurumsal API uç noktaları sıfır veri saklama (Zero Data Retention) ve gizlilik şartlarıyla çalıştırılır.',
            },
            {
              label: 'Doğrulanmış bilgi kuralı ve onay kapıları',
              text: 'Fiyat, çalışma saati, tarih ve telefon gibi somut değerler yalnızca işletme sahibinin doğruladığı bilgi kartlarından alınır. Doğrulanmamış bir değer içeren taslak otomatik gönderilmez; karar gerektiren işlemler (takvim değişiklikleri, yayınlama, özel talepler) işletme onayına sunulur.',
            },
            {
              label: 'Otomatik yanıt bildirimi',
              text: 'İnsan onayı olmadan otomatik gönderilen müşteri yanıtlarında şeffaflık amacıyla otomatik yanıt bildirimi (ör. “— Otomatik yanıt”) yer alır.',
            },
          ],
        },
        {
          id: 'guvenlik',
          title: '5. Teknik ve İdari Güvenlik Önlemleri',
          bullets: [
            {
              label: 'Çok kiracılı veritabanı izolasyonu',
              text: 'Tüm işletme verileri PostgreSQL Satır Düzeyinde Güvenlik (RLS) ile çalışma alanı kimliğine göre ayrıştırılır; bir işletme başka bir işletmenin verilerine erişemez.',
            },
            {
              label: 'Şifreleme ve imza doğrulama',
              text: 'Tüm trafik TLS/HTTPS ile korunur. OAuth erişim jetonları AES-256-GCM ile şifrelenir; Meta webhook çağrıları SHA-256 HMAC imzası ile doğrulanır; veritabanı yedekleri şifrelenerek saklanır.',
            },
            {
              label: 'Değişmez denetim kaydı ve log temizleme',
              text: 'Yönetimsel denetim kayıtları yalnızca eklenebilir yapıdadır. Hata izleme kayıtları kişisel veri, çerez, yetki başlıkları ve jetonlardan otomatik olarak arındırılır.',
            },
          ],
        },
        {
          id: 'saklama-imha',
          title: '6. Veri Saklama, İçeriksizleştirme ve Silme Süreleri',
          paragraphs: [
            'Kişisel veriler yalnızca işleme amacının gerektirdiği süre boyunca saklanır ve günlük otomatik temizlik görevleriyle içeriksizleştirilir veya silinir:',
          ],
          table: {
            headers: ['Veri Türü', 'Saklama Süresi', 'Süre Sonu İşlemi'],
            rows: [
              [
                'Ham webhook yükleri',
                '30 gün (içerik) / 90 gün (kayıt)',
                '30. günde yük içeriği temizlenir; 90. günde kayıt satırı silinir.',
              ],
              [
                'Müşteri mesaj metinleri, taslaklar ve ses/görsel çıktıları',
                '365 gün (geçici varsayılan)',
                'Metinler silinir; yalnızca kişisel veri içermeyen toplu sayısal raporlar korunur.',
              ],
              [
                'İşletme sahibi soru ve görev metinleri',
                '180 gün',
                'Soru/cevap ve talep metinleri içeriksizleştirilir.',
              ],
              [
                'Şifreli veritabanı yedekleri',
                '35 gün',
                'Süre sonunda nesne depolamadan otomatik olarak silinir.',
              ],
              [
                'Değişmez denetim kayıtları',
                '2 yıl',
                'Uyuşmazlık çözümü ve güvenlik denetimi için kişisel mesaj metni olmadan tutulur.',
              ],
              [
                'Pilot bekleme listesi başvuruları',
                'Pilot süreci boyunca veya silme talebine kadar',
                'Talebiniz üzerine derhal sistemden silinir.',
              ],
            ],
          },
          note: 'Instagram bağlantısını kestiğinizde erişim jetonları derhal silinir ve konuşma geçmişini silme seçeneği sunulur. Çalışma alanı silme talebi 7 günlük bekleme süresinin ardından tüm kayıtların kalıcı olarak silinmesiyle sonuçlanır. Ayrıca Meta veri silme geri bildirim uç noktamız otomatik silme taleplerini destekler.',
        },
        {
          id: 'alt-isleyenler',
          title: '7. Alt Veri İşleyenler ve Yurt Dışı Aktarımlar',
          paragraphs: [
            'Hizmetin sunulabilmesi için bulut barındırma (AB bölgesi / yapılandırılabilir veri merkezi), kurumsal yapay zekâ çıkarımı (OpenAI API — Sıfır Veri Saklama kapsamında), şifreli yedekleme ve medya depolama (Cloudflare R2), işlem e-postaları (Resend) ve opsiyonel hata izleme (kişisel veriden arındırılmış Sentry) sağlayıcılarından yararlanılmaktadır.',
            'Yurt dışına yapılan veri aktarımları KVKK madde 9 (standart sözleşme / taahhütname mekanizmaları) ve GDPR Standart Sözleşme Maddeleri (SCCs) çerçevesindeki güvenlik güvenceleriyle yürütülür.',
          ],
        },
        {
          id: 'haklar-iletisim',
          title: '8. Haklarınız ve İletişim',
          paragraphs: [
            'KVKK’nın 11. maddesi ve GDPR’ın 15–22. maddeleri uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, verilerinize erişme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme ve Kişisel Verileri Koruma Kurumu’na (KVKK) veya yetkili denetim makamına şikâyette bulunma haklarına sahipsiniz.',
            'Pilot başvurunuzun silinmesi, Instagram verilerinizin kaldırılması veya gizlilikle ilgili her türlü sorunuz için bizimle iletişime geçebilirsiniz:',
          ],
          bullets: [
            { label: 'Gizlilik ve Veri Talepleri', text: 'privacy@pivoris.com' },
            { label: 'Veri Koruma Sorumlusu', text: 'dpo@pivoris.com' },
            { label: 'Konum', text: 'İstanbul, Türkiye' },
          ],
        },
      ],
    },
    terms: {
      metaTitle: `Kullanım Koşulları · ${PRODUCT_NAME}`,
      metaDescription:
        'Pivoris tanıtım sitesi, ücretsiz 30 günlük pilot programı ve işletme hesabı kullanımına ilişkin kullanım koşulları ve sorumluluk çerçevesi.',
      eyebrow: 'Yasal belgeler',
      title: 'Kullanım Koşulları',
      subtitle:
        'Bu koşullar, Pivoris web sitesini, ücretsiz pilot programını ve Pivoris platform hizmetlerini kullanımınızı düzenler. Hizmeti kullanarak veya pilota başvurarak bu koşulları kabul etmiş olursunuz.',
      versionBadge: `Sürüm ${VERSION}`,
      statusBadge: 'Taslak · hukuki inceleme bekliyor',
      effectiveDate: 'Son güncelleme: 16 Kasım 2026',
      tocTitle: 'İçindekiler',
      siblingLabel: 'İlgili belge',
      siblingCta: 'Gizlilik Politikasını oku',
      sections: [
        {
          id: 'hizmet-kapsami',
          title: '1. Hizmetin Kapsamı',
          paragraphs: [
            `${PRODUCT_NAME}, işletmelerin Instagram Direct mesajlarını ve yorumlarını yönetmesine, doğrulanmış işletme bilgilerine dayalı müşteri yanıt taslakları hazırlamasına, içerik planlamasına ve Telegram, WhatsApp veya web uygulaması (PWA) üzerinden operasyonlarını takip etmesine yardımcı olan bir yazılım hizmetidir.`,
            'Bu belge hem tanıtım sitesi ziyaretçileri ve pilot başvuru sahipleri hem de platformda çalışma alanı oluşturan işletme kullanıcıları için geçerlidir. Nihai ticari sözleşme ve kurumsal Veri İşleme Sözleşmesi (DPA) ücretli kullanım öncesinde ayrıca paylaşılır.',
          ],
        },
        {
          id: 'pilot-programi',
          title: '2. Ücretsiz Pilot Programı ve Ücretlendirme',
          bullets: [
            {
              label: '30 gün ücretsiz deneme',
              text: 'Pilot programı 30 gün boyunca ücretsizdir; başvuru veya deneme sırasında kredi kartı bilgisi istenmez ve süre sonunda kendiliğinden ücretlendirme yapılmaz.',
            },
            {
              label: 'Birlikte kurulum ve çıkış hakkı',
              text: 'Pilot süresince kurulum birlikte yapılabilir. Hizmetten memnun kalmazsanız Instagram bağlantısını keserek veya çalışma alanınızı kapatarak istediğiniz an ayrılabilirsiniz.',
            },
            {
              label: 'Ücretli döneme geçiş',
              text: 'Pilot sonrasında devam etmek isterseniz paket kapsamı, ücret ve faturalandırma düzeni başlamadan önce sizinle açıkça kararlaştırılır.',
            },
          ],
        },
        {
          id: 'hesap-yetki',
          title: '3. Hesap Güvenliği ve Bağlantı Yetkisi',
          bullets: [
            {
              label: 'Bağlantı yetkisi',
              text: 'Pivoris çalışma alanınıza bağladığınız Instagram profesyonel hesabını, takvimi, Telegram veya WhatsApp kanallarını işletme adına yönetmeye hukuken yetkili olmanız gerekir.',
            },
            {
              label: 'Resmi giriş ve hesap güvenliği',
              text: 'Instagram bağlantısı Meta’nın resmi giriş ekranı üzerinden kurulur; Instagram şifreniz Pivoris ile paylaşılmaz. Pivoris hesap parolanızı güvenli tutmak ve çalışma alanı ekip rollerini (sahip, yönetici, personel) doğru yetkilendirmek sizin sorumluluğunuzdadır.',
            },
          ],
        },
        {
          id: 'isletme-sorumlulugu',
          title: '4. İşletme Bilgileri ve İçerik Sorumluluğu',
          paragraphs: [
            'Pivoris, yanıt ve içerik üretiminde sizin doğruladığınız bilgi kartlarını (fiyatlar, çalışma saatleri, adres, hizmet koşulları) esas alır:',
          ],
          bullets: [
            {
              label: 'Bilgilerin güncelliği',
              text: 'Sistemde doğruladığınız tüm işletme bilgilerinin doğru, eksiksiz ve güncel tutulması işletmenin sorumluluğundadır.',
            },
            {
              label: 'Onay ve yayınlama kararları',
              text: 'Onayınıza sunulan müşteri yanıtları, randevu değişiklikleri ve zamanlanan paylaşımlar üzerindeki nihai sorumluluk işletmeye aittir. Otomatik yanıt seçeneklerini etkinleştirdiğinizde bu kapsamda gönderilen iletilerden de işletme sorumludur.',
            },
            {
              label: 'Müşteri aydınlatması',
              text: 'İşletme, kendi müşterilerine yönelik KVKK aydınlatma yükümlülüğünü yerine getirmekten sorumludur; Pivoris kurulumda kullanılmak üzere örnek aydınlatma metni şablonu sunar.',
            },
          ],
        },
        {
          id: 'kabul-edilebilir-kullanim',
          title: '5. Kabul Edilebilir Kullanım ve Platform Kuralları',
          paragraphs: [
            'Hizmeti yürürlükteki mevzuata (KVKK, Ticari İletişim ve Ticari Elektronik İletiler mevzuatı, tüketici hukuku dahil) ve üçüncü taraf platform kurallarına uygun şekilde kullanmayı kabul edersiniz:',
          ],
          bullets: [
            {
              label: 'Meta / Instagram kuralları',
              text: 'Instagram mesajlaşma pencereleri (24 saatlik standart yanıt süresi, yorumdan özel mesaja 7 günlük sınır ve tek mesaj limiti) ile Meta Platform Koşullarına uyulmalıdır.',
            },
            {
              label: 'Yasaklı faaliyetler',
              text: 'İstenmeyen toplu mesaj (spam), aldatıcı içerik, hukuka aykırı paylaşımlar, güvenlik kontrollerini atlatma girişimleri veya sistem kaynaklarını kötüye kullanma yasaktır.',
            },
          ],
        },
        {
          id: 'yapay-zeka-sinirlar',
          title: '6. Yapay Zekâ Özellikleri ve Üçüncü Taraf Bağımlılıkları',
          paragraphs: [
            'Asistan tarafından hazırlanan taslaklar yapay zekâ altyapısı kullanılarak üretilir. Pivoris halüsinasyon riskini azaltmak için doğrulanmış bilgi yer tutucuları ve deterministik kontroller uygular; ancak işletme sahibinin son kontrol ve denetimi esastır.',
            'Instagram, WhatsApp, Telegram, Google Takvim veya yapay zekâ API sağlayıcılarında yaşanan kesintiler, izin değişiklikleri veya hız sınırlamaları ilgili özelliğin geçici olarak duraklamasına neden olabilir. Yol haritasında “planlanan” veya “taslak” olarak belirtilen unsurlar taahhüt edilmiş canlı özellik niteliği taşımaz.',
          ],
        },
        {
          id: 'fikri-mulkiyet',
          title: '7. Fikri Mülkiyet ve Ticari Markalar',
          paragraphs: [
            `${PRODUCT_NAME} yazılımı, arayüzü, marka unsurları ve dokümantasyonu Pivoris’e aittir. İşletmenizin sisteme yüklediği görseller, metinler, fiyat bilgileri ve müşteri yazışmaları üzerindeki tüm haklar size ve ilgili hak sahiplerine aittir.`,
            'Instagram ve WhatsApp, Meta Platforms, Inc.’in ticari markalarıdır; Telegram ise sahibinin ticari markasıdır. Pivoris bu şirketlerle bağlantılı veya ortak değildir.',
          ],
        },
        {
          id: 'fesih-silme',
          title: '8. Bağlantıyı Kesme, Fesih ve Veri Silme',
          paragraphs: [
            'Instagram hesabınızın bağlantısını uygulama içinden veya Instagram ayarlarından istediğiniz zaman kaldırabilirsiniz. Çalışma alanınızı silme talebinde bulunduğunuzda 7 günlük iptal süresi boyunca otomasyon durdurulur; sürenin sonunda çalışma alanı verileri kalıcı olarak silinir.',
            'Koşulların ağır ihlali veya güvenlik tehdidi halinde Pivoris, erişimi geçici olarak askıya alma veya sonlandırma hakkını saklı tutar. Veri işleme ve silme süreçleri hakkında ayrıntılar için Gizlilik Politikamızı inceleyebilirsiniz.',
          ],
        },
        {
          id: 'sorumluluk-uygulanacak-hukuk',
          title: '9. Sorumluluk Sınırı, Değişiklikler ve Uygulanacak Hukuk',
          paragraphs: [
            'Pilot hizmeti ve yazılım, yürürlükteki emredici hukuk kurallarının izin verdiği ölçüde “olduğu gibi” sunulur. İşletmenin kendi sağladığı hatalı fiyat veya bilgilerden ya da üçüncü taraf platform kesintilerinden kaynaklanan dolaylı ticari kayıplardan Pivoris sorumlu tutulamaz.',
            'Bu koşullar hizmet geliştikçe güncellenebilir; önemli değişiklikler sürüm numarası güncellenerek yayımlanır ve kayıtlı kullanıcılara bildirilir. Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir; emredici tüketici ve veri koruma hükümleri saklıdır.',
            'Sorularınız için: privacy@pivoris.com',
          ],
        },
      ],
    },
  },
  en: {
    backHome: 'Back to home',
    applyPilot: 'Apply for the free pilot',
    contactEmail: 'privacy@pivoris.com',
    dpoEmail: 'dpo@pivoris.com',
    privacy: {
      metaTitle: `Privacy Policy · ${PRODUCT_NAME}`,
      metaDescription:
        'Learn how Pivoris collects, processes, protects, and deletes personal data across the landing site, pilot waitlist, and business platform.',
      eyebrow: 'Legal documents',
      title: 'Privacy Policy',
      subtitle:
        'This policy explains how personal data is collected, processed, protected, and deleted when you visit the Pivoris website, apply for the pilot programme, or use the Pivoris platform.',
      versionBadge: `Version ${VERSION}`,
      statusBadge: 'Draft · awaiting legal review',
      effectiveDate: 'Last updated: 16 November 2026',
      tocTitle: 'Contents',
      siblingLabel: 'Related document',
      siblingCta: 'Read Terms of Use',
      sections: [
        {
          id: 'kapsam-roller',
          title: '1. Scope & Data Protection Roles',
          paragraphs: [
            `${PRODUCT_NAME} provides AI-assisted Instagram messaging, comment handling, and content scheduling software for small and local businesses (such as Pilates and fitness studios, clinics, beauty salons, cafés, boutiques, and service providers).`,
            'Under Turkish Personal Data Protection Law No. 6698 (KVKK) and the EU General Data Protection Regulation (GDPR), responsibilities depend on the data flow:',
          ],
          bullets: [
            {
              label: 'Landing site, pilot applications, and platform accounts',
              text: `${PRODUCT_NAME} acts as the Data Controller (Veri Sorumlusu) for pilot waitlist submissions, registered user accounts, session security, and operator audit logs.`,
            },
            {
              label: 'End-customer Instagram DMs and comments',
              text: `The subscribing business (Workspace Owner) is the Data Controller for all customer messages, comments, and customer identifiers received via Instagram. ${PRODUCT_NAME} acts strictly as a Data Processor (Veri İşleyen) on the business’s documented instructions under our Data Processing Agreement (DPA).`,
            },
            {
              label: 'Independent platform providers',
              text: 'Meta Platforms Ireland Ltd. / Meta Platforms, Inc. (Instagram and WhatsApp), Telegram, and Google (when Calendar integration is enabled) operate as independent data controllers under their own terms and privacy policies.',
            },
          ],
        },
        {
          id: 'toplanan-veriler',
          title: '2. Categories of Personal Data Processed',
          paragraphs: [
            'We collect and process only the personal data strictly necessary for each purpose:',
          ],
          bullets: [
            {
              label: 'Landing site and pilot waitlist form',
              text: 'When you submit the pilot form, we collect your business name, business category, Instagram handle, email address, city, and language preference (tr/en). This website uses no advertising cookies or third-party analytics trackers; only your language and theme choices are saved in browser localStorage, and fonts are self-hosted.',
            },
            {
              label: 'Platform user and authentication data',
              text: 'Display name, email address, workspace role (owner, manager, staff), argon2id password hashes, encrypted HttpOnly session cookies, and immutable administrative audit trails (sign-in timestamps, role changes, IP addresses).',
            },
            {
              label: 'Business integration and knowledge data',
              text: 'Instagram Business account IDs, usernames, OAuth access tokens encrypted at rest with AES-256-GCM (your Instagram password never reaches Pivoris), and verified business facts (prices, opening hours, address, service details).',
            },
            {
              label: 'End-customer communications (Processor role)',
              text: 'Instagram Scoped IDs (IGSID), usernames/handles, inbound DMs and comments, sent replies, timestamps, and AI classification/draft records. If voice-note transcription or image description is enabled by the business, audio or images are processed transiently in memory during a single job and are never stored by Pivoris.',
            },
          ],
        },
        {
          id: 'amaclar-hukuki-sebepler',
          title: '3. Purposes & Legal Bases',
          paragraphs: [
            'Personal data is processed solely on valid legal grounds under KVKK Article 5 and GDPR Article 6:',
          ],
          table: {
            headers: ['Data Category', 'Processing Purpose', 'Legal Basis (KVKK / GDPR)'],
            rows: [
              [
                'Pilot waitlist applications',
                'Reviewing your application, contacting you about the pilot, and scheduling setup.',
                'Consent and pre-contractual steps (KVKK Art. 5/1, 5/2(c); GDPR Art. 6(1)(a), 6(1)(b)).',
              ],
              [
                'User accounts & authentication',
                'Creating accounts, securing sessions, managing roles, and password resets.',
                'Contract performance and legitimate interest (KVKK Art. 5/2(c), 5/2(f); GDPR Art. 6(1)(b), 6(1)(f)).',
              ],
              [
                'Instagram & channel integrations',
                'Receiving DMs/comments and sending approved replies or posts on the business’s behalf.',
                'Contract performance under DPA instructions (KVKK Art. 5/2(c); GDPR Art. 6(1)(b)).',
              ],
              [
                'Security & audit logs',
                'Preventing abuse, diagnosing errors, and fulfilling legal compliance duties.',
                'Legal obligation and security legitimate interest (KVKK Art. 5/2(ç), 5/2(f); GDPR Art. 6(1)(c), 6(1)(f)).',
              ],
            ],
          },
        },
        {
          id: 'yapay-zeka',
          title: '4. Artificial Intelligence & Grounding Safeguards',
          bullets: [
            {
              label: 'No base model training',
              text: 'Customer message text, customer identifiers, and private business facts are never used to train base artificial intelligence models. Processing runs via commercial API endpoints governed by Zero Data Retention (ZDR) terms.',
            },
            {
              label: 'Verified-fact guardrails and approvals',
              text: 'Prices, hours, dates, and phone numbers in drafted replies come from facts verified by the business owner. Drafts containing unverified values are not sent automatically, and actions requiring decisions (calendar changes, publishing, special requests) remain gated on owner approval.',
            },
            {
              label: 'Automated reply disclosure',
              text: 'Responses sent automatically without manual approval carry a transparent disclosure suffix (such as “— Otomatik yanıt” / “— Automated reply”).',
            },
          ],
        },
        {
          id: 'guvenlik',
          title: '5. Technical & Organizational Security Measures',
          bullets: [
            {
              label: 'Multi-tenant isolation',
              text: 'All tenant records are isolated at the database level with PostgreSQL Row-Level Security (RLS) keyed by workspace ID so one business can never access another’s data.',
            },
            {
              label: 'Encryption and webhook verification',
              text: 'Traffic is protected by TLS/HTTPS. OAuth tokens are encrypted at rest with AES-256-GCM, incoming Meta webhooks are verified with constant-time HMAC SHA-256 signatures, and backups are encrypted.',
            },
            {
              label: 'Immutable audit trails & telemetry scrubbing',
              text: 'Audit logs are append-only. Error monitoring automatically strips authorization headers, cookies, customer identifiers, and sensitive tokens before transmission.',
            },
          ],
        },
        {
          id: 'saklama-imha',
          title: '6. Data Retention, Redaction & Erasure',
          paragraphs: [
            'Personal data is retained only as long as needed for its purpose and is automatically redacted or deleted by daily cleanup jobs:',
          ],
          table: {
            headers: ['Data Asset', 'Retention Period', 'Action After Expiry'],
            rows: [
              [
                'Raw webhook payloads',
                '30 days (payload) / 90 days (row)',
                'Payload nulled at 30 days; metadata row deleted at 90 days.',
              ],
              [
                'Customer message text, drafts & transcripts',
                '365 days (provisional)',
                'Message text nulled; non-personal aggregate counts retained.',
              ],
              [
                'Owner tasks & clarification Q&A text',
                '180 days',
                'Question, answer, and request texts redacted.',
              ],
              [
                'Encrypted database backups',
                '35 days',
                'Automatically expired and purged from off-site object storage.',
              ],
              [
                'Immutable audit logs',
                '2 years',
                'Retained without customer message content for security & dispute compliance.',
              ],
              [
                'Pilot waitlist entries',
                'Pilot duration or until deletion request',
                'Removed promptly upon request.',
              ],
            ],
          },
          note: 'Disconnecting an Instagram account wipes access tokens immediately and lets you purge conversation history. Deleting a workspace triggers a 7-day grace period followed by permanent deletion. We also provide a Meta Data Deletion Callback endpoint for automated deletion requests.',
        },
        {
          id: 'alt-isleyenler',
          title: '7. Sub-Processors & Cross-Border Transfers',
          paragraphs: [
            'To operate the service, Pivoris uses vetted sub-processors for cloud infrastructure (EU region / configurable deployment region), enterprise AI inference (OpenAI API under Zero Data Retention), encrypted backups and media storage (Cloudflare R2), transactional email (Resend), and optional error telemetry (Sentry with PII scrubbing).',
            'Cross-border transfers outside Türkiye or the EEA rely on appropriate safeguards including KVKK Article 9 standard undertakings/contracts, Standard Contractual Clauses (SCCs), and applicable adequacy frameworks.',
          ],
        },
        {
          id: 'haklar-iletisim',
          title: '8. Your Rights & Contact',
          paragraphs: [
            'Under KVKK Article 11 and GDPR Articles 15–22, you have the right to learn whether your data is processed, request access or copies, request correction or erasure, object to certain processing, and lodge a complaint with the Turkish Data Protection Authority (KVKK) or a competent European supervisory authority.',
            'To request deletion of your pilot application, erase Instagram data, or ask any privacy question, contact us:',
          ],
          bullets: [
            { label: 'Privacy & Data Requests', text: 'privacy@pivoris.com' },
            { label: 'Data Protection Contact', text: 'dpo@pivoris.com' },
            { label: 'Location', text: 'Istanbul, Türkiye' },
          ],
        },
      ],
    },
    terms: {
      metaTitle: `Terms of Use · ${PRODUCT_NAME}`,
      metaDescription:
        'Terms governing use of the Pivoris website, the 30-day free pilot programme, and business workspace accounts.',
      eyebrow: 'Legal documents',
      title: 'Terms of Use',
      subtitle:
        'These terms govern your use of the Pivoris website, the free pilot programme, and the Pivoris platform. By accessing the site or applying for the pilot, you agree to these terms.',
      versionBadge: `Version ${VERSION}`,
      statusBadge: 'Draft · awaiting legal review',
      effectiveDate: 'Last updated: 16 November 2026',
      tocTitle: 'Contents',
      siblingLabel: 'Related document',
      siblingCta: 'Read Privacy Policy',
      sections: [
        {
          id: 'hizmet-kapsami',
          title: '1. Scope of Service',
          paragraphs: [
            `${PRODUCT_NAME} provides software that helps businesses manage Instagram Direct Messages and comments, draft customer replies grounded in verified business facts, schedule content, and manage workflows via Telegram, WhatsApp, or our web app (PWA).`,
            'These terms apply to visitors of this landing site, pilot applicants, and business users of the platform. Commercial subscription agreements and the Data Processing Agreement (DPA) are provided separately before any paid plan begins.',
          ],
        },
        {
          id: 'pilot-programi',
          title: '2. Free Pilot Programme & Billing',
          bullets: [
            {
              label: '30-day free pilot',
              text: 'The pilot is free for 30 days. No credit or debit card is required to apply or participate, and there are no automatic charges when the pilot ends.',
            },
            {
              label: 'Assisted setup and freedom to leave',
              text: 'We help you set up during the pilot. You may stop using the service at any time by disconnecting your Instagram account or closing your workspace.',
            },
            {
              label: 'Moving to a paid plan',
              text: 'If you choose to continue after the pilot, package scope, pricing, and invoicing arrangements are agreed with you explicitly before any billing begins.',
            },
          ],
        },
        {
          id: 'hesap-yetki',
          title: '3. Account Eligibility & Authorization',
          bullets: [
            {
              label: 'Authority to connect',
              text: 'You must be legally authorized to connect and manage any Instagram Professional account, calendar, Telegram account, or WhatsApp channel linked to your workspace.',
            },
            {
              label: 'Official sign-in and credential security',
              text: 'Instagram connects through Meta’s official login flow; your Instagram password is never shared with Pivoris. You are responsible for safeguarding your Pivoris login credentials and assigning appropriate workspace roles (owner, manager, staff).',
            },
          ],
        },
        {
          id: 'isletme-sorumlulugu',
          title: '4. Business Information & Customer Communications',
          paragraphs: [
            'Pivoris relies on the business facts (prices, hours, address, service policies) that you verify in your workspace:',
          ],
          bullets: [
            {
              label: 'Accuracy of facts',
              text: 'Keeping your verified business facts accurate, lawful, and up to date is your responsibility.',
            },
            {
              label: 'Approvals and automated sending',
              text: 'You remain responsible for replies you approve, content you schedule or publish, and any automatic-reply modes you choose to enable.',
            },
            {
              label: 'Customer privacy notices',
              text: 'As the Data Controller for your end-customers, you are responsible for providing any required privacy notice (such as a KVKK Aydınlatma Metni). Pivoris provides a draft template during setup for review with your own legal counsel.',
            },
          ],
        },
        {
          id: 'kabul-edilebilir-kullanim',
          title: '5. Acceptable Use & Platform Compliance',
          paragraphs: [
            'You agree to use Pivoris lawfully and in compliance with applicable data protection, consumer, and commercial messaging laws, as well as third-party platform rules:',
          ],
          bullets: [
            {
              label: 'Meta / Instagram platform rules',
              text: 'Use must respect Meta Platform Terms and messaging limits (such as the 24-hour standard DM window and the 7-day single private-reply limit on comments).',
            },
            {
              label: 'Prohibited conduct',
              text: 'You must not use the service for unsolicited spam, deceptive or unlawful communications, attempts to bypass security controls, or abuse of system resources.',
            },
          ],
        },
        {
          id: 'yapay-zeka-sinirlar',
          title: '6. AI Features & Third-Party Dependencies',
          paragraphs: [
            'Drafts and summaries are generated using AI services combined with deterministic fact-grounding checks. While Pivoris restricts factual values to verified cards, human supervision remains essential.',
            'Availability of integrations depends on third-party providers (including Meta, Telegram, Google, and AI APIs). Items labeled as “planned” or “draft” describe intended capabilities and do not constitute binding live feature guarantees.',
          ],
        },
        {
          id: 'fikri-mulkiyet',
          title: '7. Intellectual Property & Trademarks',
          paragraphs: [
            `The ${PRODUCT_NAME} software, interface, brand identity, and documentation belong to Pivoris. You retain all rights to your business facts, media assets, and customer communications.`,
            'Instagram and WhatsApp are trademarks of Meta Platforms, Inc.; Telegram is a trademark of its owner. Pivoris is not affiliated with or endorsed by these companies.',
          ],
        },
        {
          id: 'fesih-silme',
          title: '8. Disconnection, Termination & Data Deletion',
          paragraphs: [
            'You may disconnect your Instagram account at any time from the app or your Instagram settings. Requesting workspace deletion places the workspace into a 7-day cancellation grace period during which automation is paused, followed by permanent erasure.',
            'Pivoris may suspend or terminate access in the event of material breach or security risk. See the Privacy Policy for full details on retention and deletion.',
          ],
        },
        {
          id: 'sorumluluk-uygulanacak-hukuk',
          title: '9. Limitation of Liability, Changes & Governing Law',
          paragraphs: [
            'To the maximum extent permitted by applicable law, the pilot and software are provided “as is”. Pivoris is not liable for indirect commercial losses arising from inaccurate facts entered by a business or outages of third-party platforms.',
            'We may update these terms as the product evolves by updating the version number and notifying registered users of material changes. These terms are governed by the laws of the Republic of Türkiye, without prejudice to mandatory consumer or data protection rights.',
            'Questions: privacy@pivoris.com',
          ],
        },
      ],
    },
  },
}
