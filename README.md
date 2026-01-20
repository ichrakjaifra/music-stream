# 🎵 MusicStream - Application de Gestion et Lecture de Musique Locale

<div align="center">
![Angular](https://img.shields.io/badge/Angular-17+-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7.0+-B7178C?style=for-the-badge&logo=reactivex&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3+-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![IndexedDB](https://img.shields.io/badge/IndexedDB-Native-FF9900?style=for-the-badge&logo=googlechrome&logoColor=white)

Une application musicale complète pour gérer et écouter votre bibliothèque musicale locale 🎧

</div>

## 🎯 Contexte et Objectif

MusicStream est une application musicale avancée basée sur Angular, conçue pour offrir une expérience complète de gestion et d'écoute de musique locale. L'application combine une interface utilisateur moderne avec une architecture robuste utilisant les dernières fonctionnalités d'Angular (Signals, Standalone Components, etc.).

L'objectif principal est de créer une plateforme musicale fonctionnelle et intuitive, permettant aux utilisateurs d'organiser, rechercher et écouter leur musique locale avec une expérience similaire aux services de streaming modernes.

## ✨ Fonctionnalités Principales

### 🎼 Gestion Complète des Musiques

Système CRUD Avancé pour chaque musique

Métadonnées enrichies : titre, artiste, catégorie, durée, etc.

Images de couverture optionnelles avec validation

Catégorisation musicale (Pop, Rock, Jazz, Classique, etc.)

Statistiques automatiques (nombre d'écoutes, likes)

### 📁 Stockage Local Intelligent

IndexedDB pour le stockage des fichiers audio (jusqu'à 10MB)

localStorage pour les préférences utilisateur

Validation stricte des formats (MP3, WAV, OGG, M4A)

Sauvegarde et restauration automatiques

🎧 Lecteur Audio Professionnel
Contrôles complets : play/pause, suivant/précédent, volume

Barre de progression interactive avec prévisualisation

Mode aléatoire et répétition

File d'attente dynamique avec gestion avancée

Raccourcis clavier pour une utilisation rapide

### 🔍 Navigation et Recherche

Bibliothèque complète avec filtres multiples

Recherche intelligente par titre, artiste ou catégorie

Page de détails pour chaque musique

Navigation fluide avec lazy loading

### 🎨 Interface Utilisateur Moderne

Design responsive adapté à tous les écrans

Thème sombre par défaut avec effets glassmorphism

Animations fluides et feedback visuel

Indicateurs de chargement et gestion d'erreurs

## 🏗️ Architecture Technique

### Stack Technologique

| Composant | Version | Usage |
|-----------|---------|-------|
| **Angular** | 17+ | Framework principal |
| **TypeScript** | 5.0+ | Langage de programmation |
| **RxJS** | 7.0+ | Programmation réactive |
| **Signals** | Angular 17+ | Gestion d'état réactive |
| **Bootstrap** | 5.3+ | Framework CSS |
| **IndexedDB** | Native Browser | Stockage des fichiers |
| **HTML Audio API** | Native Browser | Lecture audio |

## 🚀 Démarrage Rapide

### Prérequis

Node.js 18+ et npm 9+

Angular CLI 17+

Navigateur moderne supportant IndexedDB

## Installation

1. **Cloner le projet**

```bash
git clone https://github.com/votre-username/music-stream.git
cd music-stream
```

2. **Installer les dépendances**

```bash
npm install
```

3. **Lancer l'application en développement**

```bash
ng serve
```

4. **Accéder à l'application**

```bash
Application : http://localhost:4200
```

##" 📖 Guide d'Utilisation

### Ajouter de la Musique

1. Accédez à la Bibliothèque

2. Cliquez sur "Ajouter une musique"

3. Remplissez les informations :

- Titre (max 50 caractères)

- Artiste (max 50 caractères)

- Catégorie (Pop, Rock, Jazz, etc.)

- Description optionnelle (max 200 caractères)

- Fichier audio (MP3, WAV, OGG, M4A - max 10MB)

- Image de couverture optionnelle (JPEG, PNG, WebP - max 2MB)

### Écouter de la Musique

1. Navigation : Parcourez votre bibliothèque

2. Lecture : Cliquez sur une musique pour la jouer

3. Contrôles : Utilisez le lecteur en bas de page

4. File d'attente : Ajoutez des musiques pour écouter en continu

