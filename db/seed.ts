import 'dotenv/config';
import { db } from './index';
import { quests, quizzes } from './schema';

async function seed() {
  console.log('Seeding database...');

  // Quest 1: First Steps
  const [quest1] = await db.insert(quests).values({
    title: 'First Steps',
    description: 'Understand what a Bitcoin address is.',
    type: 'beginner',
    xpReward: 50,
    satsReward: 10,
    requiredLevel: 1,
    order: 1,
    content: {
      introduction: 'Welcome to your first quest! In this lesson, you will learn the fundamentals of Bitcoin addresses and how they work.',
      sections: [
        {
          title: 'What is a Bitcoin Address?',
          content: 'A Bitcoin address is like a bank account number. It\'s a unique identifier that allows you to receive Bitcoin. Addresses typically start with 1, 3, or bc1.\n\nExample: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          miniQuiz: {
            question: 'What does a Bitcoin address allow you to do?',
            options: [
              'Send Bitcoin only',
              'Receive Bitcoin only',
              'Both send and receive Bitcoin',
              'Mine Bitcoin'
            ],
            correctAnswer: 2,
            explanation: 'A Bitcoin address allows you to receive Bitcoin. To send Bitcoin, you need the private key associated with that address.'
          }
        },
        {
          title: 'Types of Addresses',
          content: 'There are three main types of Bitcoin addresses:\n\n1. Legacy (P2PKH): Starts with "1"\n2. Script (P2SH): Starts with "3"\n3. SegWit (Bech32): Starts with "bc1"\n\nSegWit addresses are the most modern and efficient.',
          miniQuiz: {
            question: 'Which address type is the most modern?',
            options: [
              'Legacy (starts with 1)',
              'Script (starts with 3)',
              'SegWit (starts with bc1)',
              'All are equally modern'
            ],
            correctAnswer: 2,
            explanation: 'SegWit (Bech32) addresses starting with "bc1" are the most modern, offering lower fees and better efficiency.'
          }
        }
      ],
      practicalMission: {
        title: 'Generate Your First Address',
        description: 'Use BitLab to generate a Bitcoin address',
        steps: [
          'Open BitLab',
          'Navigate to the Wallet section',
          'Click "Generate New Address"',
          'Copy your address'
        ],
        bitlabAction: 'generate_address',
        validationCriteria: ['Address generated', 'Address format valid']
      }
    }
  }).returning();

  await db.insert(quizzes).values({
    questId: quest1.id,
    passingScore: 70,
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What is the primary purpose of a Bitcoin address?',
        options: [
          'To mine Bitcoin',
          'To receive Bitcoin',
          'To store private keys',
          'To validate transactions'
        ],
        correctAnswer: 1,
        explanation: 'Bitcoin addresses are primarily used to receive Bitcoin. They are derived from public keys.',
        points: 25
      },
      {
        id: 'q2',
        type: 'true-false',
        question: 'A Bitcoin address and a private key are the same thing.',
        correctAnswer: false,
        explanation: 'False. A Bitcoin address is public and used to receive funds. A private key is secret and used to spend funds.',
        points: 25
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        question: 'Which address format offers the lowest transaction fees?',
        options: [
          'Legacy (P2PKH)',
          'Script (P2SH)',
          'SegWit (Bech32)',
          'All have the same fees'
        ],
        correctAnswer: 2,
        explanation: 'SegWit (Bech32) addresses offer the lowest transaction fees due to their efficient data structure.',
        points: 25
      },
      {
        id: 'q4',
        type: 'true-false',
        question: 'You can share your Bitcoin address publicly without security risk.',
        correctAnswer: true,
        explanation: 'True. Bitcoin addresses are meant to be shared publicly to receive payments. Only private keys must be kept secret.',
        points: 25
      }
    ]
  });

  console.log('Quest 1 seeded');

  // Quest 2: Your First Transaction
  const [quest2] = await db.insert(quests).values({
    title: 'Your First Transaction',
    description: 'Send sats on the testnet.',
    type: 'intermediate',
    xpReward: 100,
    satsReward: 25,
    requiredLevel: 1,
    order: 2,
    content: {
      introduction: 'Now that you understand addresses, let\'s learn how to create and send your first Bitcoin transaction!',
      sections: [
        {
          title: 'What is a Transaction?',
          content: 'A Bitcoin transaction is a transfer of value between Bitcoin addresses. It consists of:\n\n- Inputs: Where the Bitcoin comes from\n- Outputs: Where the Bitcoin goes\n- Fee: Payment to miners for processing',
          miniQuiz: {
            question: 'What are the three main components of a Bitcoin transaction?',
            options: [
              'Sender, receiver, amount',
              'Inputs, outputs, fee',
              'Address, signature, timestamp',
              'Block, hash, nonce'
            ],
            correctAnswer: 1,
            explanation: 'A transaction consists of inputs (source of funds), outputs (destination), and a fee for miners.'
          }
        },
        {
          title: 'Transaction Fees',
          content: 'Transaction fees incentivize miners to include your transaction in a block. Higher fees = faster confirmation.\n\nFees are measured in satoshis per byte (sat/vB).',
          miniQuiz: {
            question: 'What happens if you set a very low transaction fee?',
            options: [
              'Transaction is rejected',
              'Transaction confirms slower',
              'Transaction is free',
              'Transaction fails'
            ],
            correctAnswer: 1,
            explanation: 'Low fees mean miners are less incentivized to include your transaction, resulting in slower confirmation times.'
          }
        }
      ],
      practicalMission: {
        title: 'Send Your First Transaction',
        description: 'Create and broadcast a transaction on testnet',
        steps: [
          'Open BitLab',
          'Get testnet coins from faucet',
          'Create a transaction',
          'Set appropriate fee',
          'Sign and broadcast'
        ],
        bitlabAction: 'send_transaction',
        validationCriteria: ['Transaction created', 'Transaction signed', 'Transaction broadcast']
      }
    }
  }).returning();

  await db.insert(quizzes).values({
    questId: quest2.id,
    passingScore: 75,
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What determines how quickly a transaction is confirmed?',
        options: [
          'Transaction amount',
          'Transaction fee',
          'Sender reputation',
          'Time of day'
        ],
        correctAnswer: 1,
        explanation: 'Transaction fees determine priority. Higher fees incentivize miners to include your transaction sooner.',
        points: 30
      },
      {
        id: 'q2',
        type: 'true-false',
        question: 'Once a transaction is broadcast, it cannot be cancelled.',
        correctAnswer: true,
        explanation: 'True. Once broadcast to the network, a transaction cannot be cancelled. It can only be replaced with a higher fee (RBF) before confirmation.',
        points: 20
      },
      {
        id: 'q3',
        type: 'multiple-choice',
        question: 'What is a UTXO?',
        options: [
          'Unspent Transaction Output',
          'Universal Transaction Optimization',
          'Unified Transfer Object',
          'User Transaction Order'
        ],
        correctAnswer: 0,
        explanation: 'UTXO stands for Unspent Transaction Output. It represents Bitcoin that can be spent.',
        points: 30
      },
      {
        id: 'q4',
        type: 'true-false',
        question: 'Testnet Bitcoin has real monetary value.',
        correctAnswer: false,
        explanation: 'False. Testnet Bitcoin is for testing only and has no real value.',
        points: 20
      }
    ]
  });

  console.log('Quest 2 seeded');
  console.log('Database seeded successfully');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
