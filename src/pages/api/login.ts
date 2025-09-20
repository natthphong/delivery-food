import { NextApiRequest, NextApiResponse } from 'next';
import axios from '../../utils/externalApiClient';
import {AxiosResponse} from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { username, password } = req.body;

        try {
            const response:AxiosResponse<any> = await axios.post('/iam/api/v1/auth/login', {
                appCode: 'GIAM',
                username,
                password,
            });

            const { accessToken, refreshToken, jwtBody } = response.data.body;
            const currentRole:any = jwtBody?.roles?.[0];
            res.status(200).json({
                accessToken,
                refreshToken,
                currentRole,
            });
        } catch (error: any) {
            console.log(error)
            if (error.response) {
                res.status(error.response.status).json({
                    error: error.response.data.error || 'An error occurred in the external service',
                });
            } else {
                res.status(500).json({
                    error: 'Unable to reach the external service',
                });
            }
        }
    } else {
        // Handle unsupported HTTP methods
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
