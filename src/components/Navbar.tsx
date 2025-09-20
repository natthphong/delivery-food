import Link from 'next/link';

const Navbar: React.FC = () => (
    <nav style={{ padding: '10px', background: '#333', color: '#fff' }}>
        <Link href="/render" style={{ marginRight: '10px', color: '#fff' }}>
            Render
        </Link>
        <Link href="/login" style={{ color: '#fff' }}>
            Login
        </Link>
    </nav>
);

export default Navbar;
