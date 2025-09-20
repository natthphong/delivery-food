import React, { useState } from 'react';
import Layout from '../components/Layout';
import axios from '../utils/apiClient';
import {AxiosResponse} from "axios";

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleLogin = async () => {
        try {
            const response:AxiosResponse<any> = await axios.post('/api/login', { username, password });
            setMessage(`Login successful: ${response.data.message}`);
        } catch (error: any) {
            setMessage(`Error: ${error.response?.data?.error || error.message}`);
        }
    };

    return (
        <Layout>
            <h1>Login Page</h1>
            <input
                type="username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ marginBottom: '10px', display: 'block' }}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginBottom: '10px', display: 'block' }}
            />
            <button onClick={handleLogin}>Login</button>
            {message && <p>{message}</p>}
        </Layout>
    );
};

export default LoginPage;
