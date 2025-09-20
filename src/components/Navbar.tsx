import Link from "next/link";

const Navbar: React.FC = () => (
    <nav className="bg-white border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="text-lg font-semibold text-emerald-600">
                FoodieGo
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-700">
                <Link href="/account" className="px-3 py-2 rounded-lg hover:bg-gray-100">
                    Account
                </Link>
            </div>
        </div>
    </nav>
);

export default Navbar;
