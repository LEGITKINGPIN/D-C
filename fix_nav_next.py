import re

path = r"c:\Users\meets\Desktop\D&C MEDIAHOUSE\dc-mediahouse-next\src\components\SiteComponents.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add use client and Link import if not present
if '"use client"' not in content:
    content = '"use client";\n' + content

if 'import Link from "next/link"' not in content:
    content = content.replace(
        'import { useSanityProjects }',
        'import Link from "next/link";\nimport { usePathname } from "next/navigation";\nimport { useSanityProjects }'
    )

# Fix Navbar function definition
if 'const pathname = usePathname();' not in content:
    content = content.replace(
        'export function Navbar({ activeView = "home", setActiveView }: { activeView?: string; setActiveView?: (v: string) => void }) {',
        'export function Navbar() {\n  const pathname = usePathname();\n  const activeView = pathname === "/about" ? "about" : "home";'
    )

# Fix logo
logo_old = """        <div 
          className="relative group cursor-pointer"
          onClick={() => {
            setActiveView?.("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <div className="text-xl md:text-2xl font-playfair font-semibold tracking-tight text-[#F8F5F0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            D&C <span className="text-xs md:text-sm font-sans font-bold uppercase tracking-[0.3em] ml-1 text-[#C5A059]">MediaHouse</span>
          </div>
        </div>"""

logo_new = """        <Link 
          href="/"
          className="relative group cursor-pointer"
          onClick={() => {
            setIsMenuOpen(false);
          }}
        >
          <div className="text-xl md:text-2xl font-playfair font-semibold tracking-tight text-[#F8F5F0] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            D&C <span className="text-xs md:text-sm font-sans font-bold uppercase tracking-[0.3em] ml-1 text-[#C5A059]">MediaHouse</span>
          </div>
        </Link>"""

content = content.replace(logo_old, logo_new)

# Fix Desktop Nav
desktop_old = """          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={(e) => {
                if (item === "About") {
                  e.preventDefault();
                  setActiveView?.("about");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  if (activeView === "about") {
                    e.preventDefault();
                    setActiveView?.("home");
                    setTimeout(() => {
                      document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }
                }
              }}
              className={cn(
                "text-[11px] font-inter font-medium uppercase tracking-[2px] hover:text-[#C5A059] transition-all duration-300 relative group py-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]",
                (activeView === "about" && item === "About") ? "text-[#C5A059]" : "text-[#F8F5F0]/70"
              )}
            >
              {item}
              <span className="absolute bottom-0 left-0 h-[1px] bg-[#C5A059] transition-all duration-300 group-hover:w-full w-0" />
            </a>
          ))}"""

desktop_new = """          {navItems.map((item) => {
            const isAbout = item === "About";
            const href = isAbout ? "/about" : `/#${item.toLowerCase()}`;
            return (
            <Link
              key={item}
              href={href}
              className={cn(
                "text-[11px] font-inter font-medium uppercase tracking-[2px] hover:text-[#C5A059] transition-all duration-300 relative group py-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]",
                (activeView === "about" && isAbout) ? "text-[#C5A059]" : "text-[#F8F5F0]/70"
              )}
            >
              {item}
              <span className="absolute bottom-0 left-0 h-[1px] bg-[#C5A059] transition-all duration-300 group-hover:w-full w-0" />
            </Link>
          )})}"""

content = content.replace(desktop_old, desktop_new)

# Fix Mobile Nav
mobile_old = """              {navItems.map((item, idx) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={(e) => {
                    setIsMenuOpen(false);
                    if (item === "About") {
                      e.preventDefault();
                      setActiveView?.("about");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    } else {
                      if (activeView === "about") {
                        e.preventDefault();
                        setActiveView?.("home");
                        setTimeout(() => {
                          document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }
                    }
                  }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                  className="text-3xl font-playfair font-medium text-[#1C1C1C] hover:text-[#C2A36B] transition-colors"
                >
                  {item}
                </motion.a>
              ))}"""

mobile_new = """              {navItems.map((item, idx) => {
                const isAbout = item === "About";
                const href = isAbout ? "/about" : `/#${item.toLowerCase()}`;
                return (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                >
                  <Link
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-3xl font-playfair font-medium text-[#1C1C1C] hover:text-[#C2A36B] transition-colors"
                  >
                    {item}
                  </Link>
                </motion.div>
              )})}"""

content = content.replace(mobile_old, mobile_new)

# Fix Contact export
content = content.replace(
    'export function Contact({ setActiveView }: { setActiveView?: (v: string) => void }) {',
    'export function Contact() {'
)

contact_link_old = """            <a
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                setActiveView?.("about");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-white/50 hover:text-white transition-colors"
            >
              About D&C MediaHouse
            </a>"""

contact_link_new = """            <Link href="/about" className="text-white/50 hover:text-white transition-colors">
              About D&C MediaHouse
            </Link>"""

content = content.replace(contact_link_old, contact_link_new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated SiteComponents.tsx")
