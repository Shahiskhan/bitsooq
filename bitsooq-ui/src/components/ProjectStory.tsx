import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Blocks, CreditCard, Languages, Wallet } from 'lucide-react';
import { landingCopy } from '../data/landing-copy';

const icons = { card: CreditCard, crypto: Wallet, language: Languages, layers: Blocks } as const;

export default function ProjectStory() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const copy = ar ? landingCopy.ar : landingCopy.en;
  return (
    <>
      <section className="story-section px-4 py-12 sm:px-6 sm:py-16" id="story">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-16">
          <div className="story-side-note">
            <span className="story-orbit story-orbit-one" /><span className="story-orbit story-orbit-two" />
            <div className="story-pakistan-mark"><span>PK</span><i>↗</i></div>
            <div className="story-connection-card"><span className="kanz-mark">K</span><span><b>Kanz → Moyasar</b><small>{ar ? 'كيف بدأت فكرة الدفع' : 'Where the payment idea clicked'}</small></span><ArrowUpRight size={16} /></div>
            <span className="story-side-caption">BITSOOQ · BUILT FROM PAKISTAN</span>
          </div>
          <div className="story-copy">
            <p className="section-eyebrow"><span />{copy.storyEyebrow}</p>
            <h2>{copy.storyTitle}</h2>
            <p className="story-body">{copy.storyBody}</p>
            <p className="story-note">{copy.storyNote}</p>
            <a href="#platform" className="story-link">{ar ? 'اكتشف مكونات المنصة' : 'See what powers the platform'} <ArrowUpRight size={16} /></a>
          </div>
        </div>
      </section>

      <section className="platform-section px-4 py-14 sm:px-6 sm:py-20" id="platform">
        <div className="mx-auto max-w-7xl">
          <div className="platform-heading">
            <div><p className="section-eyebrow"><span />{copy.platformEyebrow}</p><h2>{copy.platformTitle}</h2></div>
            <p>{copy.platformSubtitle}</p>
          </div>
          <div className="platform-grid">
            {copy.cards.map((card, index) => {
              const Icon = icons[card.icon];
              return <article key={card.title} className={`platform-card platform-card-${card.icon}`}>
                <div className="platform-card-top"><span className="platform-icon"><Icon size={19} /></span><span className="platform-index">0{index + 1}</span></div>
                <p className="platform-kicker">{card.kicker}</p><h3>{card.title}</h3><p className="platform-body">{card.body}</p>
                {card.icon === 'crypto' && <span className="beta-badge platform-beta">{ar ? 'الإصدار التجريبي · شبكات الاختبار' : 'Beta · Testnet ready'}</span>}
                {card.icon === 'card' && <div className="payment-brands"><span>Mada</span><span>VISA</span><span>Mastercard</span><span>Apple Pay</span></div>}
                {card.icon === 'language' && <div className="language-pair"><span>EN</span><i>↔</i><span lang="ar" dir="rtl">عربي</span></div>}
                {card.icon === 'layers' && <div className="service-chips"><span>Catalog</span><span>Orders</span><span>Payments</span></div>}
              </article>;
            })}
          </div>
        </div>
      </section>
    </>
  );
}
