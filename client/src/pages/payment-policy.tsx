// client/src/pages/payment-policy.tsx
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import ResidentShell from "@/components/layout/ResidentShell";

export default function PaymentPolicy() {
  const [, setLocation] = useLocation();

  return (
    <ResidentShell currentPage="chat">
      <div className="max-w-4xl mx-auto p-8">
          {/* Back Button */}
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/checkout-diagnosis")}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="text-sm text-emerald-600 font-medium mb-2">Privacy Policy</p>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">We care about your privacy</h1>
            <p className="text-gray-600">
              Your privacy is important to us at CityConnect. We respect your privacy regarding any 
              information we may collect from you across our website.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-6 border-b border-gray-200 mb-8">
            <button className="pb-3 border-b-2 border-emerald-600 text-emerald-600 font-medium">
              Human-friendly
            </button>
            <button className="pb-3 text-gray-500 hover:text-gray-700">
              Legal nonsense
            </button>
          </div>

          {/* Content Sections */}
          <div className="space-y-12">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vi tincidunt ex in quam rutrum ligula ac odio, amet vel etiam suspendisse necat auctor. 
                Faucibus arget vestibulum falli bisti morbi ante mauris et sit. Tellus eleifend varius arcat, 
                etiam. Mauris massa eu ante amet, vitae ut et facilisect maqna turpis id.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Nisi, volutpat malesuada egestas, semper ut velit neque dolore sit volupat mauris lectus moli. 
                Velit eel autem quam odor mauris moli et lacicullus augue octor amet amet. 
                Nascetur placerat volutpat, et nullass. In mollis eu scelerisque imperdiet, vitam molestie sagitis 
                pretium mollis sit mi mi vestus. Velit consequent imperdiet arcu ut pulvinar moris leo.
              </p>
            </section>

            {/* What information do we collect? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                What information do we collect?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Dolor enim eu tortor urna sed duis nulla. Aliquam vestibulum, nulla odio nisl vitae. In aliquet 
                pellentesque aenean hac vestibulum turpis mi bibendum diam. Tempor integer aliquam in vitae 
                malesuada fringilla.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Elit nisi in eleifend sed nisi. Pulvinar at orci, proin imperdiet commodo consectetur convallis 
                risus. Sed condimentum enim dignissim adipiscing faucibus consequat, urna. Viverra purus et erat 
                auctor aliquam. Risus, volutpat vulputate posuere purus sit congue convallis aliquet. Arcu id 
                augue ut feugiat donec porttitor neque. Mauris, neque ultricies eu vestibulum, bibendum 
                quam lorem id. Dolor lacus, eget nunc lectus in tellus, pharetra, porttitor.
              </p>
            </section>

            {/* How do we use your information? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                How do we use your information?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Dolor enim eu tortor urna sed duis nulla. Aliquam vestibulum, nulla odio nisl vitae. In aliquet 
                pellentesque aenean hac vestibulum turpis mi bibendum diam. Tempor integer aliquam in vitae 
                malesuada fringilla.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Elit nisi in eleifend sed nisi. Pulvinar at orci, proin imperdiet commodo consectetur convallis 
                risus. Sed condimentum enim dignissim adipiscing faucibus consequat, urna. Viverra purus et erat 
                auctor aliquam. Risus, volutpat vulputate posuere purus sit congue convallis aliquet. Arcu id 
                augue ut feugiat donec porttitor neque. Mauris, neque ultricies eu vestibulum, bibendum 
                quam lorem id. Dolor lacus, eget nunc lectus in tellus, pharetra, porttitor.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Incursed mattis diam quam ante, Gravida dignissim molumenis et nam pellentesque augue. 
                Congue eget tempus cursus turpis. Sapien, dictum molestie niam volutpat. Etiam elit cras, 
                faucibus lacerat tempus, torquis viti scel at vestis falli. Necu nisl, malesuada melli sit amet, 
                interculit elit.
              </p>
            </section>

            {/* Do we use cookies and other tracking technologies? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Do we use cookies and other tracking technologies?
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Pharetra morbi libero id aliquam elit massa integer tellus. Quis felis aliquam ullamcorper 
                porttitor. Pulvinar ullamcorper sit dictumst ut eget a, elementum eu. Maecenas est morbi 
                mattis id in ac pellentesque ac.
              </p>
            </section>

            {/* How long do we keep your information? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                How long do we keep your information?
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Pharetra morbi libero id aliquam elit massa integer tellus. Quis felis aliquam ullamcorper 
                porttitor. Pulvinar ullamcorper sit dictumst ut eget a, elementum eu. Maecenas est morbi 
                mattis id in ac pellentesque ac.
              </p>
            </section>

            {/* How do we keep your information safe? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                How do we keep your information safe?
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Pharetra morbi libero id aliquam elit massa integer tellus. Quis felis aliquam ullamcorper 
                porttitor. Pulvinar ullamcorper sit dictumst ut eget a, elementum eu. Maecenas est morbi 
                mattis id in ac pellentesque ac.
              </p>
            </section>

            {/* What are your privacy rights? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                What are your privacy rights?
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Pharetra morbi libero id aliquam elit massa integer tellus. Quis felis aliquam ullamcorper 
                porttitor. Pulvinar ullamcorper sit dictumst ut eget a, elementum eu. Maecenas est morbi 
                mattis id in ac pellentesque ac.
              </p>
            </section>

            {/* How can you contact us about this policy? */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                How can you contact us about this policy?
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Sagittis et eu at elementum, quis in. Proin praesent volutpat egestas sociis sit lorem nunc 
                nunc sit. Eget diam curabitur mi ac. Auctor rutrum lacus malesuada massa ornare et. Vulputate 
                consectetur ac ultrices at diam et, scelerisque hac nibh. Sodales lectus nibh placerat volutpat 
                diam egestas. Nam fermentum pharetra, et luctus vellectum augue in.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>
                  Luctus arcu finibus varius porttitor velit praesent massa pretii.
                </li>
                <li>
                  Eu nisl <a href="#" className="text-emerald-600 hover:underline">pellentesque semper finistcrat</a> velit praesent ultricies suspendisse. Auctor amet eu.
                </li>
                <li>
                  Suspendisse consequat mi proin <a href="#" className="text-emerald-600 hover:underline">donec scelerisque ipsum</a> dolor mi vulputat porttitora.
                </li>
              </ol>
            </section>
          </div>
        </div>
    </ResidentShell>
  );
}
