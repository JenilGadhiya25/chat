import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/axios";

// Country list — common ones first
const COUNTRIES = [
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Germany", code: "+49", flag: "🇩🇪" },
  { name: "France", code: "+33", flag: "🇫🇷" },
  { name: "Brazil", code: "+55", flag: "🇧🇷" },
  { name: "Japan", code: "+81", flag: "🇯🇵" },
  { name: "China", code: "+86", flag: "🇨🇳" },
  { name: "Russia", code: "+7", flag: "🇷🇺" },
  { name: "South Africa", code: "+27", flag: "🇿🇦" },
  { name: "UAE", code: "+971", flag: "🇦🇪" },
  { name: "Pakistan", code: "+92", flag: "🇵🇰" },
  { name: "Bangladesh", code: "+880", flag: "🇧🇩" },
  { name: "Nigeria", code: "+234", flag: "🇳🇬" },
  { name: "Mexico", code: "+52", flag: "🇲🇽" },
  { name: "Indonesia", code: "+62", flag: "🇮🇩" },
  { name: "Turkey", code: "+90", flag: "🇹🇷" },
  { name: "Italy", code: "+39", flag: "🇮🇹" },
  { name: "Spain", code: "+34", flag: "🇪🇸" },
  { name: "Netherlands", code: "+31", flag: "🇳🇱" },
  { name: "Singapore", code: "+65", flag: "🇸🇬" },
  { name: "Malaysia", code: "+60", flag: "🇲🇾" },
  { name: "Philippines", code: "+63", flag: "🇵🇭" },
  { name: "Thailand", code: "+66", flag: "🇹🇭" },
  { name: "Vietnam", code: "+84", flag: "🇻🇳" },
  { name: "Egypt", code: "+20", flag: "🇪🇬" },
  { name: "Kenya", code: "+254", flag: "🇰🇪" },
  { name: "Argentina", code: "+54", flag: "🇦🇷" },
];

export default function PhonePage() {
  const navigate = useNavigate();
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Wake up Render server immediately when user lands on this page
  useEffect(() => {
    api.get("/auth/ping").catch(() => {});
  }, []);

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.includes(countrySearch)
  );

  const handleNext = (e) => {
    e.preventDefault();
    // Any number is accepted — just navigate to login
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#111b21] p-4">
      {/* Green top bar */}
      <div className="w-full h-[220px] bg-[#00a884] absolute top-0 left-0" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-lg mb-3">
            <svg className="w-9 h-9 text-[#00a884]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <h1 className="text-2xl font-light text-gray-800 dark:text-white tracking-wide">WhatsApp</h1>
        </div>

        <div className="bg-white dark:bg-[#1f2c33] rounded-2xl shadow-xl overflow-visible">
          <div className="px-7 pt-7 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1 text-center">
              Enter your phone number
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center leading-relaxed">
              Enter your phone number to continue to WhatsApp.
            </p>

            <form onSubmit={handleNext} className="space-y-4">
              {/* Country selector */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Country
                </label>
                <button
                  type="button"
                  onClick={() => { setShowDropdown((v) => !v); setCountrySearch(""); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                >
                  <span className="text-xl">{country.flag}</span>
                  <span className="flex-1 text-left">{country.name}</span>
                  <span className="text-gray-400 text-xs">{country.code}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#233138] border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                      <input
                        autoFocus
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search country..."
                        className="w-full px-3 py-2 text-sm bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.name + c.code}
                          type="button"
                          onClick={() => { setCountry(c); setShowDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] text-left transition"
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="flex-1 text-sm text-gray-800 dark:text-[#e9edef]">{c.name}</span>
                          <span className="text-xs text-gray-400">{c.code}</span>
                        </button>
                      ))}
                      {filteredCountries.length === 0 && (
                        <p className="text-center text-sm text-gray-400 py-4">No results</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Phone number input */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  Phone number
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-500 dark:text-gray-400 text-sm font-medium flex-shrink-0">
                    {country.code}
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    maxLength={15}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-[#f0f2f5] dark:bg-[#2a3942] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00a884] text-sm tracking-widest"
                  />
                </div>
              </div>

              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
                By tapping Next, you agree to our{" "}
                <span className="text-[#00a884]">Terms of Service</span> and{" "}
                <span className="text-[#00a884]">Privacy Policy</span>.
              </p>

              <button
                type="submit"
                className="w-full py-3 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold rounded-lg transition text-sm"
              >
                Next
              </button>
            </form>
          </div>

          <div className="px-7 py-4 bg-gray-50 dark:bg-[#111b21] border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-[#00a884] font-semibold hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
