export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Votely Backend API",
    version: "0.1.0",
    description: "Dokumentasi API untuk autentikasi, face verification, election, voting, admin, dan upload Votely.",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local backend",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Face Verification" },
    { name: "Elections" },
    { name: "Voting" },
    { name: "Admin" },
    { name: "Upload" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
      },
    },
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Unauthorized" },
          details: { type: "object", nullable: true },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          role: { type: "string", enum: ["ADMIN", "WARGA"] },
          walletAddress: { type: "string" },
        },
      },
      Candidate: {
        type: "object",
        properties: {
          id: { type: "string", example: "1" },
          electionId: { type: "string", example: "1" },
          name: { type: "string", example: "Jane Doe" },
          party: { type: "string", example: "Partai Contoh" },
          description: { type: "string", nullable: true },
          photoUrl: { type: "string", nullable: true },
          orderIndex: { type: "integer", example: 0 },
          chainCandidateId: { type: "string", nullable: true },
          voteCount: { type: "integer", nullable: true },
        },
      },
      Election: {
        type: "object",
        properties: {
          id: { type: "string", example: "1" },
          name: { type: "string", example: "Pemilihan Ketua" },
          description: { type: "string" },
          level: { type: "string", example: "PROVINSI" },
          city: { type: "string", nullable: true },
          province: { type: "string", nullable: true },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          chainElectionId: { type: "string", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          candidates: {
            type: "array",
            items: { $ref: "#/components/schemas/Candidate" },
          },
          totalVotes: { type: "integer", nullable: true },
        },
      },
      ElectionInput: {
        type: "object",
        required: ["name", "description", "level", "startTime", "endTime"],
        properties: {
          name: { type: "string", example: "Pemilihan Ketua" },
          description: { type: "string", example: "Pemilihan ketua periode 2026" },
          level: { type: "string", example: "PROVINSI" },
          city: { type: "string", nullable: true },
          province: { type: "string", nullable: true },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          candidates: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "party"],
              properties: {
                name: { type: "string" },
                party: { type: "string" },
                description: { type: "string" },
                photoUrl: { type: "string" },
              },
            },
          },
          voterCsv: {
            type: "string",
            description: "CSV pemilih opsional saat create-and-deploy.",
          },
        },
      },
      FaceVerifyResponse: {
        type: "object",
        properties: {
          verified: { type: "boolean" },
          similarity: { type: "number", example: 0.82 },
          similarities: {
            type: "array",
            items: { type: "number" },
          },
          snapshotCount: { type: "integer", example: 3 },
          face_detected: { type: "boolean" },
          voteToken: { type: "string", nullable: true },
          expiresIn: { type: "integer", nullable: true },
          message: { type: "string" },
        },
      },
      VoteStatus: {
        type: "object",
        properties: {
          hasVoted: { type: "boolean" },
          candidateId: { type: "string", nullable: true },
          candidateName: { type: "string", nullable: true },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Cek status backend",
        responses: {
          "200": {
            description: "Backend aktif",
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login admin dengan NIK dan password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nik", "password"],
                properties: {
                  nik: { type: "string", example: "3201010101010001" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login berhasil" },
          "400": { description: "NIK/password kosong" },
          "401": { description: "Kredensial salah" },
          "403": { description: "Bukan akun admin" },
        },
      },
    },
    "/api/auth/face-login": {
      post: {
        tags: ["Auth"],
        summary: "Login pemilih dengan NIK",
        description: "Login mobile hanya membuat sesi pemilih. Verifikasi wajah dilakukan saat meminta voteToken sebelum voting.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nik"],
                properties: {
                  nik: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Login berhasil" },
          "400": { description: "Data tidak lengkap" },
          "401": { description: "NIK tidak terdaftar sebagai peserta pemilu" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Ambil user saat ini",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "User aktif" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout dan hapus cookie token",
        responses: {
          "200": { description: "Logout berhasil" },
        },
      },
    },
    "/api/auth/validate-credentials": {
      post: {
        tags: ["Auth"],
        summary: "Validasi kredensial admin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nik", "password"],
                properties: {
                  nik: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Valid" },
          "401": { description: "Tidak valid" },
        },
      },
    },
    "/api/auth/verify": {
      get: {
        tags: ["Auth"],
        summary: "Verifikasi token",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "Token valid" },
          "401": { description: "Token tidak valid" },
        },
      },
    },
    "/api/face-verify": {
      post: {
        tags: ["Face Verification"],
        summary: "Verifikasi wajah",
        description: "Untuk voting, kirim electionId agar backend membuat voteToken jika wajah terverifikasi.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nik: { type: "string", description: "Opsional jika token sudah membawa NIK" },
                  electionId: { type: "string" },
                  image: {
                    oneOf: [
                      { type: "string", description: "Base64 image" },
                      { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Hasil verifikasi",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FaceVerifyResponse" },
              },
            },
          },
          "400": { description: "Request tidak valid" },
          "404": { description: "Embedding/user tidak ditemukan" },
        },
      },
    },
    "/api/face-verify/generate-embedding": {
      post: {
        tags: ["Face Verification"],
        summary: "Generate embedding wajah dari image",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: { type: "string", description: "Base64 image" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Embedding berhasil dibuat" },
          "400": { description: "Wajah tidak terdeteksi" },
        },
      },
    },
    "/api/elections": {
      get: {
        tags: ["Elections"],
        summary: "Ambil daftar election",
        description: "Tambahkan ?forUser=true untuk daftar election sesuai peserta yang login.",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "forUser",
            in: "query",
            schema: { type: "boolean" },
          },
        ],
        responses: {
          "200": {
            description: "Daftar election",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Election" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/elections/{electionId}": {
      get: {
        tags: ["Elections"],
        summary: "Detail election untuk peserta",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
          { name: "includeResults", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "Detail election" },
          "404": { description: "Tidak ditemukan atau bukan peserta" },
        },
      },
    },
    "/api/elections/{electionId}/results": {
      get: {
        tags: ["Elections"],
        summary: "Hasil election setelah selesai",
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Hasil election" },
          "403": { description: "Hasil belum tersedia" },
          "404": { description: "Election tidak ditemukan" },
        },
      },
    },
    "/api/vote/check": {
      get: {
        tags: ["Voting"],
        summary: "Cek status vote user",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Status vote",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: { $ref: "#/components/schemas/VoteStatus" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/vote/cast": {
      post: {
        tags: ["Voting"],
        summary: "Kirim vote",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["electionId", "candidateId", "voteToken"],
                properties: {
                  electionId: { type: "string" },
                  candidateId: { type: "string" },
                  voteToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Vote berhasil" },
          "400": { description: "Request tidak valid" },
          "403": { description: "Bukan peserta" },
        },
      },
    },
    "/api/admin/elections": {
      get: {
        tags: ["Admin"],
        summary: "Daftar election milik admin login",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "Daftar election admin" },
          "403": { description: "Admin required" },
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Buat election tanpa deploy blockchain",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ElectionInput" } },
          },
        },
        responses: {
          "201": { description: "Election dibuat" },
        },
      },
    },
    "/api/admin/elections/create-and-deploy": {
      post: {
        tags: ["Admin"],
        summary: "Buat election dan deploy ke blockchain",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ElectionInput" } },
          },
        },
        responses: {
          "200": { description: "Election dibuat dan dideploy" },
          "400": { description: "Validasi gagal" },
          "500": { description: "Blockchain/server error" },
        },
      },
    },
    "/api/admin/elections/{electionId}": {
      get: {
        tags: ["Admin"],
        summary: "Detail election milik admin",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
          { name: "includeResults", in: "query", schema: { type: "boolean" } },
        ],
        responses: { "200": { description: "Detail election" }, "404": { description: "Tidak ditemukan" } },
      },
      put: {
        tags: ["Admin"],
        summary: "Update election milik admin",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ElectionInput" } },
          },
        },
        responses: { "200": { description: "Election diupdate" }, "404": { description: "Tidak ditemukan" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Soft delete election milik admin",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Election dihapus" }, "404": { description: "Tidak ditemukan" } },
      },
    },
    "/api/admin/elections/{electionId}/candidates": {
      get: {
        tags: ["Admin"],
        summary: "Daftar kandidat election",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Daftar kandidat" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Tambah kandidat",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "party"],
                properties: {
                  name: { type: "string" },
                  party: { type: "string" },
                  description: { type: "string" },
                  photoUrl: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Kandidat ditambah" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Hapus kandidat",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
          { name: "candidateId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Kandidat dihapus" } },
      },
    },
    "/api/admin/elections/{electionId}/stats": {
      get: {
        tags: ["Admin"],
        summary: "Statistik election milik admin",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Statistik election" } },
      },
    },
    "/api/admin/reports/elections/{electionId}": {
      get: {
        tags: ["Admin"],
        summary: "Laporan election milik admin",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: "electionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Report election" } },
      },
    },
    "/api/admin/voters/import": {
      post: {
        tags: ["Admin"],
        summary: "Import peserta election via CSV",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["electionId", "file"],
                properties: {
                  electionId: { type: "string" },
                  file: { type: "string", format: "binary" },
                },
              },
            },
            "application/json": {
              schema: {
                type: "object",
                required: ["electionId", "csv"],
                properties: {
                  electionId: { type: "string" },
                  csv: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Import berhasil" }, "400": { description: "CSV tidak valid" } },
      },
    },
    "/api/upload/candidate-photo": {
      post: {
        tags: ["Upload"],
        summary: "Upload foto kandidat",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Upload berhasil" }, "400": { description: "File tidak ada" } },
      },
    },
  },
} as const;
