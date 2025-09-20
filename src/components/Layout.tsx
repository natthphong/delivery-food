import React from 'react';
import Navbar from './Navbar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>
        <Navbar />
        <main style={{ padding: '20px' }}>{children}</main>
    </>
);

export default Layout;
