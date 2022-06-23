import encrypted from '../../../solana.enc';
import uploadReqSchema from '@/schemas/uploadReqSchema';
import Arweave from 'arweave';
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const uploadToArweave = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
        const { base64, title, description } = await uploadReqSchema.validate(
            req.body,
        );

        try {
            const arweave = Arweave.init({
                host: 'arweave.net',
                port: 443,
                protocol: 'https',
                timeout: 20000,
                logging: false,
            });

            const data = Buffer.from(base64, 'base64');

            const transaction = await arweave.createTransaction({
                data: data,
            });

            transaction.addTag('Content-Type', 'image/png');

            const algorithm = 'aes-128-cbc';
            const decipher = crypto.createDecipheriv(
                algorithm,
                process.env.SERVICE_ENCRYPTION_KEY,
                process.env.SERVICE_ENCRYPTION_IV,
            );
            let decrypted = decipher.update(
                encrypted.encrypted,
                'base64',
                'utf8',
            );
            decrypted;
            decrypted += decipher.final('utf8');
            const wallet = JSON.parse(decrypted).ARWEAVE_WALLET;

            await arweave.transactions.sign(transaction, wallet);

            await arweave.transactions.post(transaction);

            const id = transaction.id;
            const imageUrl = id ? `https://arweave.net/${id}` : undefined;

            const metadata = {
                name: title,
                description: description,
                seller_fee_basis_points: 500,
                external_url: 'https://solkudos.xyz',
                collection: {
                    name: 'solkudos',
                    family: 'kudos',
                },
                properties: {
                    files: [
                        {
                            uri: imageUrl,
                            type: 'image/png',
                        },
                    ],
                    category: 'image',
                    maxSupply: 0,
                    creators: [
                        {
                            address:
                                '22LHwfhQhtxjQ7hyKQYecbZ3zBx6PRcrsXKLDGprivpY',
                            share: 100,
                        },
                    ],
                },
                image: imageUrl,
            };

            const metadataRequest = JSON.stringify(metadata);

            const metadataTransaction = await arweave.createTransaction({
                data: metadataRequest,
            });

            metadataTransaction.addTag('Content-Type', 'application/json');

            await arweave.transactions.sign(metadataTransaction, wallet);
            await arweave.transactions.post(metadataTransaction);

            return res.status(200).json({
                image: imageUrl,
                metadata: `https://arweave.net/${metadataTransaction.id}`,
            });
        } catch (err) {
            return res.status(500).json({
                message:
                    'An error occurred while uploading the data to arweave',
                error: err,
            });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
};

export default uploadToArweave;
