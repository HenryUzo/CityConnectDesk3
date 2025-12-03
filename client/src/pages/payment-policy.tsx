// client/src/pages/payment-policy.tsx
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  Home, 
  BarChart3, 
  Layers, 
  FileText, 
  Flag,
  Users,
  Settings,
  HelpCircle,
  Wrench,
  Clock,
  Shirt,
  MapPin
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PaymentPolicy() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Primary Left Sidebar */}
      <div className="w-16 bg-emerald-700 flex flex-col items-center py-6 space-y-6">
        <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
          <MapPin className="w-6 h-6 text-emerald-800" />
        </div>
        
        <nav className="flex-1 flex flex-col items-center space-y-4">
          <Link href="/resident">
            <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
          </Link>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <BarChart3 className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Layers className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Flag className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Users className="w-5 h-5 text-white" />
          </button>
        </nav>

        <div className="flex flex-col items-center space-y-4">
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">OR</span>
          </div>
        </div>
      </div>

      {/* Secondary Left Navigation */}
      <div className="w-60 bg-emerald-800 text-white flex flex-col">
        <div className="p-4 border-b border-emerald-700">
          <Link href="/book-artisan">
            <button className="flex items-center text-white/80 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="text-sm">Book a Service</span>
            </button>
          </Link>
        </div>

        <nav className="flex-1 py-4">
          <Link href="/book-artisan">
            <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
              <Wrench className="w-5 h-5" />
              <span>Service Categories</span>
              <Badge className="ml-auto bg-white text-emerald-800 text-xs">40</Badge>
            </button>
          </Link>
          
          <Link href="/book-artisan">
            <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
              <Wrench className="w-5 h-5" />
              <span>Book Repairs</span>
            </button>
          </Link>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Clock className="w-5 h-5" />
            <span>Schedule Maintenance</span>
          </button>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Shirt className="w-5 h-5" />
            <span>Do your Laundry</span>
          </button>
        </nav>

        <div className="p-4 border-t border-emerald-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user?.name?.charAt(0) || 'O'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Olivia Rhye'}</p>
              <p className="text-xs text-white/60 truncate">{user?.email || 'olivia@untitledui.com'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
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
      </div>
    </div>
  );
}
